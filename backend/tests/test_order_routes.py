import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store


@pytest.fixture(autouse=True)
def clean_stores() -> None:
    reset_memory_store()
    reset_order_memory_store()


@pytest.mark.asyncio
async def test_create_order_requires_authentication(client: AsyncClient) -> None:
    response = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Leather Backpack",
            "total_minor": 250000,
            "required_advance_minor": 50000,
            "payment_account_id": "some-id",
        },
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_order_validation_rules(client: AsyncClient) -> None:
    seller = SellerIdentity(owner_id="seller_val_test")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    try:
        # Create shop
        await client.post(
            "/api/seller/shop",
            json={"display_name": "Validation Shop"},
            headers={"Idempotency-Key": "shop-key-val"},
        )
        # Create account
        acc_resp = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "bkash", "receiving_number": "01711223344", "label": "Merchant bKash"},
            headers={"Idempotency-Key": "acc-key-val"},
        )
        account_id = acc_resp.json()["id"]

        # 1. Total minor <= 0
        resp = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Shoes",
                "total_minor": 0,
                "required_advance_minor": 50000,
                "payment_account_id": account_id,
            },
            headers={"Idempotency-Key": "ord-val-1"},
        )
        assert resp.status_code == 422

        # 2. Required advance <= 0
        resp = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Shoes",
                "total_minor": 200000,
                "required_advance_minor": -10,
                "payment_account_id": account_id,
            },
            headers={"Idempotency-Key": "ord-val-2"},
        )
        assert resp.status_code == 422

        # 3. Required advance > total
        resp = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Shoes",
                "total_minor": 100000,
                "required_advance_minor": 150000,
                "payment_account_id": account_id,
            },
            headers={"Idempotency-Key": "ord-val-3"},
        )
        assert resp.status_code == 422
        assert "advance cannot exceed" in str(resp.json()).lower()

        # 4. Blank product name
        resp = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "   ",
                "total_minor": 100000,
                "required_advance_minor": 20000,
                "payment_account_id": account_id,
            },
            headers={"Idempotency-Key": "ord-val-4"},
        )
        assert resp.status_code == 422

        # 5. Non-existent payment account
        resp = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Shoes",
                "total_minor": 100000,
                "required_advance_minor": 20000,
                "payment_account_id": "non-existent-account-id",
            },
            headers={"Idempotency-Key": "ord-val-5"},
        )
        assert resp.status_code in (404, 422)

        # 6. Inactive payment account cannot be selected for new order (AC06)
        await client.patch(
            f"/api/seller/payment-accounts/{account_id}",
            json={"expected_version": 1, "is_active": False},
        )
        resp = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Shoes",
                "total_minor": 100000,
                "required_advance_minor": 20000,
                "payment_account_id": account_id,
            },
            headers={"Idempotency-Key": "ord-val-6"},
        )
        assert resp.status_code in (400, 422)
        assert "inactive" in str(resp.json()).lower()

    finally:
        app.dependency_overrides.pop(get_seller_identity, None)


@pytest.mark.asyncio
async def test_order_idempotency_semantics(client: AsyncClient) -> None:
    seller = SellerIdentity(owner_id="seller_idem_test")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    try:
        await client.post(
            "/api/seller/shop",
            json={"display_name": "Idem Shop"},
            headers={"Idempotency-Key": "shop-key-idem"},
        )
        acc_resp = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "bkash", "receiving_number": "01722334455", "label": "Main bKash"},
            headers={"Idempotency-Key": "acc-key-idem"},
        )
        acc_id = acc_resp.json()["id"]

        idem_key = "order-create-idem-key"
        payload = {
            "product_name": "Wireless Mouse",
            "total_minor": 120000,
            "required_advance_minor": 20000,
            "payment_account_id": acc_id,
        }

        # First request
        resp1 = await client.post("/api/seller/orders", json=payload, headers={"Idempotency-Key": idem_key})
        assert resp1.status_code == 201
        order_id = resp1.json()["id"]

        # Replay same key and payload -> returns same order
        resp2 = await client.post("/api/seller/orders", json=payload, headers={"Idempotency-Key": idem_key})
        assert resp2.status_code in (200, 201)
        assert resp2.json()["id"] == order_id

        # Replay same key with different payload -> 409 IDEMPOTENCY_KEY_REUSED (AC38)
        conflict_payload = {**payload, "product_name": "Ergonomic Keyboard"}
        resp3 = await client.post("/api/seller/orders", json=conflict_payload, headers={"Idempotency-Key": idem_key})
        assert resp3.status_code == 409
        assert resp3.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"

    finally:
        app.dependency_overrides.pop(get_seller_identity, None)
