import datetime
from unittest.mock import patch

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
async def test_order_creation_snapshotting_and_link_retrieval(client: AsyncClient) -> None:
    seller = SellerIdentity(owner_id="seller_snapshot_test")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    try:
        await client.post(
            "/api/seller/shop",
            json={"display_name": "Fashion Hub"},
            headers={"Idempotency-Key": "shop-key-fash"},
        )
        acc_resp = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "nagad", "receiving_number": "01811223344", "label": "Nagad Personal"},
            headers={"Idempotency-Key": "acc-key-fash"},
        )
        acc_id = acc_resp.json()["id"]

        # Create valid order
        create_payload = {
            "product_name": "Silk Saree",
            "total_minor": 350000,  # 3500 BDT
            "required_advance_minor": 50000,  # 500 BDT
            "payment_account_id": acc_id,
        }
        resp = await client.post(
            "/api/seller/orders",
            json=create_payload,
            headers={"Idempotency-Key": "order-fash-1"},
        )
        assert resp.status_code == 201
        order = resp.json()

        order_id = order["id"]
        assert order["product_name"] == "Silk Saree"
        assert order["total_minor"] == 350000
        assert order["required_advance_minor"] == 50000
        assert order["expected_cod_minor"] == 300000  # 350000 - 50000
        assert order["lifecycle"] == "awaiting_buyer"
        assert order["version"] == 1
        assert "portal_token" in order
        assert "portal_url" in order
        assert order["portal_token"] in order["portal_url"]

        # Check snapshot fields
        assert order["payment_account_id"] == acc_id
        assert order["account_provider"] == "nagad"
        assert order["account_receiving_number"] == "01811223344"
        assert order["account_label"] == "Nagad Personal"

        # Check 48-hour UTC deadline
        created_at = datetime.datetime.fromisoformat(order["created_at"])
        expires_at = datetime.datetime.fromisoformat(order["expires_at"])
        diff = expires_at - created_at
        assert abs(diff.total_seconds() - 48 * 3600) < 5

        # Relabel and deactivate the payment account (AC06)
        await client.patch(
            f"/api/seller/payment-accounts/{acc_id}",
            json={"expected_version": 1, "label": "Changed Label", "is_active": False},
        )

        # Inspect order: snapshot must NEVER be modified by account edits
        detail_resp = await client.get(f"/api/seller/orders/{order_id}")
        assert detail_resp.status_code == 200
        inspected = detail_resp.json()
        assert inspected["account_label"] == "Nagad Personal"
        assert inspected["account_receiving_number"] == "01811223344"
        assert inspected["account_provider"] == "nagad"

    finally:
        app.dependency_overrides.pop(get_seller_identity, None)


@pytest.mark.asyncio
async def test_order_resolve_and_cross_shop_isolation(client: AsyncClient) -> None:
    # Shop A creates order
    seller_a = SellerIdentity(owner_id="seller_shop_a")
    app.dependency_overrides[get_seller_identity] = lambda: seller_a
    try:
        await client.post("/api/seller/shop", json={"display_name": "Shop A"}, headers={"Idempotency-Key": "k-a1"})
        acc_a = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "bkash", "receiving_number": "01711111111", "label": "A-Acc"},
            headers={"Idempotency-Key": "k-a2"},
        )
        acc_a_id = acc_a.json()["id"]

        order_a = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Shop A Product",
                "total_minor": 100000,
                "required_advance_minor": 20000,
                "payment_account_id": acc_a_id,
            },
            headers={"Idempotency-Key": "k-a3"},
        )
        assert order_a.status_code == 201
        order_a_id = order_a.json()["id"]
        token_a = order_a.json()["portal_token"]

        # Shop A resolves its own token -> succeeds
        resolve_resp = await client.post("/api/seller/order-links/resolve", json={"portal_token": token_a})
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["order_id"] == order_a_id
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)

    # Shop B attempts to resolve or read Shop A's order (AC02)
    seller_b = SellerIdentity(owner_id="seller_shop_b")
    app.dependency_overrides[get_seller_identity] = lambda: seller_b
    try:
        await client.post("/api/seller/shop", json={"display_name": "Shop B"}, headers={"Idempotency-Key": "k-b1"})

        # 1. Shop B attempts to GET Shop A's order -> 404
        resp_read = await client.get(f"/api/seller/orders/{order_a_id}")
        assert resp_read.status_code == 404

        # 2. Shop B attempts to resolve Shop A's token -> 404
        resp_resolve = await client.post("/api/seller/order-links/resolve", json={"portal_token": token_a})
        assert resp_resolve.status_code == 404

        # 3. Shop B attempts to create order using Shop A's payment account -> 404 or 422
        resp_create = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Shop B Fraud Order",
                "total_minor": 100000,
                "required_advance_minor": 20000,
                "payment_account_id": acc_a_id,
            },
            headers={"Idempotency-Key": "k-b2"},
        )
        assert resp_create.status_code in (404, 422)

    finally:
        app.dependency_overrides.pop(get_seller_identity, None)


@pytest.mark.asyncio
async def test_dynamic_expiry_on_read_and_deadline(client: AsyncClient) -> None:
    seller = SellerIdentity(owner_id="seller_expiry_test")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    try:
        await client.post("/api/seller/shop", json={"display_name": "Expiry Shop"}, headers={"Idempotency-Key": "k-e1"})
        acc = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "bkash", "receiving_number": "01733445566", "label": "Acc"},
            headers={"Idempotency-Key": "k-e2"},
        )
        order_resp = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Time Sensitive Item",
                "total_minor": 50000,
                "required_advance_minor": 10000,
                "payment_account_id": acc.json()["id"],
            },
            headers={"Idempotency-Key": "k-e3"},
        )
        order_id = order_resp.json()["id"]
        expires_at = datetime.datetime.fromisoformat(order_resp.json()["expires_at"])

        # Check before deadline: status is awaiting_buyer
        before_time = expires_at - datetime.timedelta(minutes=5)
        with patch("app.services.order_service.get_utc_now", return_value=before_time):
            resp = await client.get(f"/api/seller/orders/{order_id}")
            assert resp.status_code == 200
            assert resp.json()["lifecycle"] == "awaiting_buyer"
            assert resp.json()["completed_at"] is None

        # Check at/after deadline (AC31): status becomes expired, completed_at is set
        after_time = expires_at + datetime.timedelta(minutes=1)
        with patch("app.services.order_service.get_utc_now", return_value=after_time):
            resp = await client.get(f"/api/seller/orders/{order_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["lifecycle"] == "expired"
            assert data["completed_at"] is not None
            # Terminal completed_at is recorded
            assert datetime.datetime.fromisoformat(data["completed_at"]) <= after_time

    finally:
        app.dependency_overrides.pop(get_seller_identity, None)
