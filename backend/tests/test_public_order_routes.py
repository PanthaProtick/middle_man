import datetime

import pytest
from httpx import AsyncClient

from app.api.public_orders import get_buyer_clock
from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.core.tokens import get_utc_now
from app.main import app
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store


@pytest.fixture(autouse=True)
def clean_memory_stores():
    reset_memory_store()
    reset_order_memory_store()
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(verify_public_access_gate, None)
    app.dependency_overrides.pop(get_buyer_clock, None)
    reset_memory_store()
    reset_order_memory_store()


@pytest.fixture
def seller_identity():
    seller = SellerIdentity(owner_id="seller_public_test_1")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    yield seller
    app.dependency_overrides.pop(get_seller_identity, None)


async def _create_test_order(client: AsyncClient) -> dict:
    # Setup shop
    await client.post(
        "/api/seller/shop",
        json={"display_name": "Protick Gadgets"},
        headers={"Idempotency-Key": "setup-shop-1"},
    )
    # Setup account
    acc_res = await client.post(
        "/api/seller/payment-accounts",
        json={
            "provider": "bkash",
            "receiving_number": "01712345678",
            "label": "Merchant Primary",
        },
        headers={"Idempotency-Key": "setup-acc-1"},
    )
    account_id = acc_res.json()["id"]

    # Create order
    order_res = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Vintage Mechanical Keyboard",
            "total_minor": 1200000,  # 12,000 BDT
            "required_advance_minor": 200000,  # 2,000 BDT
            "payment_account_id": account_id,
        },
        headers={"Idempotency-Key": "setup-order-1"},
    )
    assert order_res.status_code == 201
    return order_res.json()


@pytest.mark.asyncio
async def test_public_policy_gate_blocks_live_unsettled_access(client: AsyncClient, seller_identity):
    app.dependency_overrides.pop(verify_public_access_gate, None)
    # Request headers cannot grant permission
    res = await client.get(
        "/api/public/orders/some-random-token",
        headers={"X-Test-Public-Gate-Disabled": "true"},
    )
    assert res.status_code == 503
    data = res.json()
    assert data["error"]["code"] == "PUBLIC_ACCESS_POLICY_UNSETTLED"


@pytest.mark.asyncio
async def test_get_public_order_returns_public_projection_without_personal_data(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]

    res = await client.get(f"/api/public/orders/{token}")
    assert res.status_code == 200
    data = res.json()

    # Check public commercial terms & instructions
    assert data["product_name"] == "Vintage Mechanical Keyboard"
    assert data["total_minor"] == 1200000
    assert data["required_advance_minor"] == 200000
    assert data["expected_cod_minor"] == 1000000
    assert data["actual_cod_minor"] is None
    assert data["account_provider"] == "bkash"
    assert data["account_receiving_number"] == "01712345678"
    assert data["account_label"] == "Merchant Primary"
    assert data["lifecycle"] == "awaiting_buyer"
    assert data["shop_display_name"] == "Protick Gadgets"

    # Ensure no private/personal or internal seller fields leak
    assert "owner_id" not in data
    assert "encrypted_portal_token" not in data
    assert "review_reasons" not in data


@pytest.mark.asyncio
async def test_get_public_order_not_found(client: AsyncClient):
    res = await client.get("/api/public/orders/non-existent-token")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_get_public_order_expired_evaluates_atomically(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]

    # Freeze/inject time after 48h expiry
    future_time = get_utc_now() + datetime.timedelta(hours=49)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: future_time
    res = await client.get(
        f"/api/public/orders/{token}",
        headers={"X-Test-Now": future_time.isoformat()},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["lifecycle"] == "expired"


@pytest.mark.asyncio
async def test_submission_strictly_at_or_after_deadline_returns_410(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]

    # Submit exactly at or after expiry (AC31)
    future_time = get_utc_now() + datetime.timedelta(hours=48, seconds=1)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: future_time
    submission_payload = {
        "buyer_name": "Arif Hasan",
        "contact_number": "01711111111",
        "address": {"raw_text": "House 10, Road 4, Dhanmondi, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "TXN1001",
            "sender_number": "01822222222",
            "amount_minor": 200000,
        },
    }

    res = await client.post(
        f"/api/public/orders/{token}/submission",
        json=submission_payload,
        headers={
            "Idempotency-Key": "buyer-sub-1",
            "X-Test-Now": future_time.isoformat(),
        },
    )
    assert res.status_code == 410
    assert res.json()["error"]["code"] == "EXPIRED_SUBMISSION"


@pytest.mark.asyncio
async def test_valid_manual_submission_and_idempotency(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]

    submission_payload = {
        "buyer_name": "Arif Hasan",
        "contact_number": "০১৭১১-১১১১১১",  # Bangla digits & hyphen
        "address": {"raw_text": "House 10, Road 4, Dhanmondi, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "  TXN9999  ",  # Boundary whitespace
            "sender_number": "+880 1822-222222",  # Different sender number with +880
            "amount_minor": 200000,
        },
    }

    # First submission
    res = await client.post(
        f"/api/public/orders/{token}/submission",
        json=submission_payload,
        headers={"Idempotency-Key": "buyer-sub-valid-1"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["lifecycle"] == "pending"
    assert data["submission_acknowledgement"] is not None
    # PublicOrder does not leak personal data
    assert "buyer_name" not in data
    assert "contact_number" not in data
    assert "address" not in data
    assert "payment_claim" not in data

    # Idempotent replay with same key & same payload
    replay_res = await client.post(
        f"/api/public/orders/{token}/submission",
        json=submission_payload,
        headers={"Idempotency-Key": "buyer-sub-valid-1"},
    )
    assert replay_res.status_code == 200
    assert replay_res.json()["lifecycle"] == "pending"

    # Idempotency key reuse with different payload -> 409
    different_payload = {**submission_payload, "buyer_name": "Different Name"}
    conflict_key_res = await client.post(
        f"/api/public/orders/{token}/submission",
        json=different_payload,
        headers={"Idempotency-Key": "buyer-sub-valid-1"},
    )
    assert conflict_key_res.status_code == 409
    assert conflict_key_res.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"

    # Subsequent submission with different key -> 409 already submitted
    new_key_res = await client.post(
        f"/api/public/orders/{token}/submission",
        json=different_payload,
        headers={"Idempotency-Key": "buyer-sub-another-key"},
    )
    assert new_key_res.status_code == 409
    assert new_key_res.json()["error"]["code"] == "ORDER_ALREADY_SUBMITTED"


@pytest.mark.asyncio
async def test_pending_submitted_order_never_expires_automatically(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]

    submission_payload = {
        "buyer_name": "Arif Hasan",
        "contact_number": "01711111111",
        "address": {"raw_text": "House 10, Road 4, Dhanmondi, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "TXN1001",
            "sender_number": "01822222222",
            "amount_minor": 200000,
        },
    }
    await client.post(
        f"/api/public/orders/{token}/submission",
        json=submission_payload,
        headers={"Idempotency-Key": "buyer-sub-1"},
    )

    # Fast forward time past 48h
    future_time = get_utc_now() + datetime.timedelta(hours=50)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: future_time
    res = await client.get(
        f"/api/public/orders/{token}",
        headers={"X-Test-Now": future_time.isoformat()},
    )
    assert res.status_code == 200
    # Remains pending, NOT expired!
    assert res.json()["lifecycle"] == "pending"


@pytest.mark.asyncio
async def test_token_possession_does_not_grant_seller_mutation_authority(client: AsyncClient, seller_identity):
    order = await _create_test_order(client)
    token = order["portal_token"]
    order_id = order["id"]

    # Clear seller override for this check
    app.dependency_overrides.pop(get_seller_identity, None)

    # Attempt to access seller endpoint using token as Bearer auth
    res = await client.get(
        f"/api/seller/orders/{order_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
