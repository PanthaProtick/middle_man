"""Public HTTP contract with the real gate; persistence is the offline adapter."""

import pytest
from httpx import AsyncClient
from test_public_order_routes import _create_test_order
from test_seller_auth_integration import _generate_rsa_key_pair, _make_token

from app.core import auth as auth_module
from app.core import public_gate
from app.core.auth import ClerkTokenVerifier
from app.core.config import Settings, settings
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store


@pytest.fixture(autouse=True)
def public_policy_state(monkeypatch):
    reset_memory_store()
    reset_order_memory_store()
    # Isolate gate configuration without turning offline persistence into durable mode.
    monkeypatch.setattr(public_gate, "settings", Settings(
        SELF_TEST_MODE=True, PUBLIC_BUYER_ACCESS_POLICY="self_test_link_possession",
    ))
    yield
    reset_memory_store()
    reset_order_memory_store()


@pytest.mark.asyncio
async def test_enabled_policy_allows_token_possession_without_buyer_identity(client: AsyncClient, monkeypatch):
    issuer = "https://clerk.integration.example.com"
    private_key, jwk = _generate_rsa_key_pair()
    monkeypatch.setattr(settings, "CLERK_ISSUER", issuer)
    monkeypatch.setattr(auth_module, "_clerk_verifier", ClerkTokenVerifier(issuer=issuer, jwks={"keys": [jwk]}))
    client.headers["Authorization"] = f"Bearer {_make_token(private_key, 'policy-seller', issuer)}"
    order = await _create_test_order(client)
    del client.headers["Authorization"]

    response = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert response.status_code == 200
    assert response.json()["product_name"] == "Vintage Mechanical Keyboard"
    assert set(response.json()) == {
        "id", "shop_display_name", "product_name", "total_minor", "required_advance_minor",
        "expected_cod_minor", "actual_cod_minor", "account_provider", "account_receiving_number",
        "account_label", "lifecycle", "status_message", "submission_acknowledgement",
        "created_at", "expires_at", "completed_at",
    }
    assert response.headers["cache-control"] == "no-store, private"
    assert response.headers["referrer-policy"] == "no-referrer"

    invalid = await client.get("/api/public/orders/invalid-token")
    assert invalid.status_code == 404
    assert invalid.json()["error"]["code"] == "NOT_FOUND"
    assert invalid.headers["cache-control"] == "no-store, private"
    assert invalid.headers["referrer-policy"] == "no-referrer"
    seller = await client.get(f"/api/seller/orders/{order['id']}")
    assert seller.status_code == 401

    submission = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={
        "buyer_name": "Synthetic Private Name", "contact_number": "01711111111",
        "address": {"raw_text": "Synthetic Private Address"},
        "payment_claim": {
            "provider": "bkash", "trx_id": "PRIVATE-RECEIPT-07",
            "sender_number": "01822222222", "amount_minor": 200000,
        },
    }, headers={"Idempotency-Key": "public-policy-submission"})
    assert submission.status_code == 200
    pending = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert pending.status_code == 200
    assert pending.json()["lifecycle"] == "pending"
    assert set(pending.json()) == set(response.json())
    for private_value in ("Synthetic Private Name", "Synthetic Private Address", "PRIVATE-RECEIPT-07", "01822222222"):
        assert private_value not in pending.text
        assert private_value not in submission.text


@pytest.mark.asyncio
@pytest.mark.parametrize(("self_test", "policy", "environment"), [
    (True, "", "test"),
    (False, "self_test_link_possession", "development"),
    (True, "self_test_link_possession", "production"),
])
async def test_unapproved_policy_denies_access(client, monkeypatch, self_test, policy, environment):
    monkeypatch.setattr(public_gate, "settings", Settings(
        SELF_TEST_MODE=self_test, PUBLIC_BUYER_ACCESS_POLICY=policy, ENV=environment,
    ))
    response = await client.get("/api/public/orders/invalid-token", headers={
        "X-Test-Public-Gate-Disabled": "true",
    })
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PUBLIC_ACCESS_POLICY_UNSETTLED"
    assert response.headers["cache-control"] == "no-store, private"
    assert response.headers["referrer-policy"] == "no-referrer"


@pytest.mark.asyncio
async def test_public_validation_does_not_echo_personal_input(client: AsyncClient):
    response = await client.post("/api/public/orders/invalid-token/submission", json={
        "buyer_name": {"private": "Synthetic Private Name"},
        "contact_number": "private-contact", "address": {"raw_text": "Private raw address"},
    }, headers={"Idempotency-Key": "invalid-private-input"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["fields"]
    assert response.json()["detail"] is None
    assert "Synthetic Private Name" not in response.text
    assert "private-contact" not in response.text
    assert "Private raw address" not in response.text
