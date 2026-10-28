import datetime

import pytest
from httpx import AsyncClient
from test_public_order_routes import _create_test_order

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.config import settings
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.services.order_service import _memory_orders, reset_order_memory_store
from app.services.seller_service import reset_memory_store


@pytest.fixture(autouse=True)
def clean_state():
    reset_memory_store()
    reset_order_memory_store()
    yield
    app.dependency_overrides.pop(verify_public_access_gate, None)
    app.dependency_overrides.pop(get_seller_identity, None)
    reset_memory_store()
    reset_order_memory_store()


@pytest.mark.asyncio
async def test_public_permission_is_denied_without_explicit_adapter(client: AsyncClient):
    response = await client.get("/api/public/orders/unknown")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PUBLIC_ACCESS_POLICY_UNSETTLED"
    assert response.headers["cache-control"] == "no-store, private"
    assert response.headers["referrer-policy"] == "no-referrer"


@pytest.mark.asyncio
async def test_caller_cannot_backdate_submission(client: AsyncClient):
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="boundary-synthetic")
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    order = await _create_test_order(client)
    expired_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)
    _memory_orders[order["id"]]["expires_at"] = expired_at
    response = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        headers={"Idempotency-Key": "backdated", "X-Test-Now": (expired_at - datetime.timedelta(hours=1)).isoformat()},
        json={
            "buyer_name": "Synthetic Buyer", "contact_number": "01711111111",
            "address": {"raw_text": "Synthetic address, Dhaka"},
            "payment_claim": {"provider": "bkash", "trx_id": "SYNTHETIC", "sender_number": "01822222222", "amount_minor": 10000},
        },
    )
    assert response.status_code == 410


@pytest.mark.parametrize("environment", ["production", "staging"])
async def test_demo_adapter_refuses_live_environments(client: AsyncClient, monkeypatch, environment):
    monkeypatch.setattr(settings, "ENV", environment)
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    assert (await client.get("/api/public/orders/unknown")).status_code == 503


async def test_demo_adapter_refuses_configured_database(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql://synthetic.invalid/synthetic")
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    assert (await client.get("/api/public/orders/unknown")).status_code == 503


async def test_public_validation_exposes_only_safe_localization_parameters(client: AsyncClient):
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    response = await client.post(
        "/api/public/orders/synthetic/submission", headers={"Idempotency-Key": "invalid-fields"},
        json={
            "buyer_name": "x" * 201, "contact_number": "private invalid phone",
            "address": {"raw_text": "Synthetic address"},
            "payment_claim": {"provider": "bkash", "trx_id": "Tx১২ab", "sender_number": "01822222222", "amount_minor": 1201},
        },
    )
    assert response.status_code == 422
    fields = {field["field"]: field for field in response.json()["error"]["fields"]}
    assert fields["buyer_name"]["code"] == "string_too_long"
    assert fields["buyer_name"]["params"] == {"max_length": 200}
    assert fields["contact_number"]["code"] == "value_error"
    assert fields["contact_number"]["params"] == {}
    assert "private invalid phone" not in response.text
