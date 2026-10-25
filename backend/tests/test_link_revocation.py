"""Buyer-link authority is independent from order lifecycle."""
import pytest
from buyer_postgres_support import PAYLOAD
from test_payment_exceptions import exception_case
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from tests.test_image_service import _create_minimal_png

__all__ = ["clean_memory_stores", "seller_identity"]


@pytest.mark.asyncio
async def test_revoke_preserves_order_and_blocks_submission_replay(client, seller_identity):
    order = await _create_test_order(client)
    public = f"/api/public/orders/{order['portal_token']}"
    submission = await client.post(public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "submit"})
    assert submission.status_code == 200
    path = f"/api/seller/orders/{order['id']}"
    before = (await client.get(path)).json()
    payload = {"expected_version": before["version"]}
    headers = {"Idempotency-Key": "revoke"}
    result = await client.post(path + "/revoke-link", json=payload, headers=headers)
    assert result.status_code == 200, result.text
    revoked = result.json()
    assert revoked["buyer_link_revoked_at"]
    assert revoked["version"] == before["version"] + 1
    for field in ("lifecycle", "expires_at", "total_minor", "required_advance_minor", "actual_cod_minor", "buyer_revision"):
        assert revoked[field] == before[field]
    assert (await client.post(path + "/revoke-link", json=payload, headers=headers)).json() == revoked
    assert (await client.get(path)).json() == revoked
    assert (await client.get(public)).status_code == 410
    replay = await client.post(public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "submit"})
    assert replay.status_code == 410
    assert replay.json()["error"]["code"] == "BUYER_LINK_REVOKED"
    changed = await client.post(path + "/revoke-link", json={"expected_version": revoked["version"]}, headers=headers)
    assert changed.status_code == 409
    stale = await client.post(path + "/revoke-link", json=payload, headers={"Idempotency-Key": "stale"})
    assert stale.status_code == 409
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="foreign")
    await client.post("/api/seller/shop", json={"display_name": "Other shop"}, headers={"Idempotency-Key": "foreign-shop"})
    assert (await client.post(path + "/revoke-link", json=payload, headers=headers)).status_code == 404
    app.dependency_overrides.pop(get_seller_identity)
    assert (await client.post(path + "/revoke-link", json=payload, headers=headers)).status_code == 401


@pytest.mark.asyncio
async def test_revoked_link_denies_upload_replay_and_both_assistance_paths(client, seller_identity):
    order = await _create_test_order(client)
    public = f"/api/public/orders/{order['portal_token']}"
    image = _create_minimal_png()
    headers = {"Idempotency-Key": "upload", "Content-Type": "image/png"}
    uploaded = await client.post(public + "/evidence", content=image, headers=headers)
    assert uploaded.status_code == 201
    result = await client.post(f"/api/seller/orders/{order['id']}/revoke-link",
                              json={"expected_version": 1}, headers={"Idempotency-Key": "revoke"})
    assert result.status_code == 200
    for key in ("upload", "fresh-upload"):
        denied = await client.post(public + "/evidence", content=image, headers={**headers, "Idempotency-Key": key})
        assert denied.status_code == 410
        assert denied.headers["cache-control"] == "no-store, private"
    for suffix, payload in (("address-extraction", {"raw_text": "Synthetic Dhaka address"}),
                            ("payment-extraction", {"evidence_id": uploaded.json()["evidence_id"]})):
        denied = await client.post(public + "/" + suffix, json={**payload, "ai_opt_in": True}, headers={"Idempotency-Key": "extract"})
        assert denied.status_code == 410, denied.text
        assert denied.json()["error"]["code"] == "BUYER_LINK_REVOKED"


async def confirmed_order_revocation(client):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"
    accepted = await client.post(path + "/decisions", json={
        "action": "confirm", "expected_version": order["version"],
        "expected_transaction_version": receipt["version"], "transaction_id": receipt["id"],
        "accepted_amount_minor": 150000, "reason": "Synthetic accepted advance",
    }, headers={"Idempotency-Key": "accept"})
    assert accepted.status_code == 200, accepted.text
    before = accepted.json()
    receipt_before = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
    revoked = await client.post(path + "/revoke-link", json={"expected_version": before["version"]},
                                headers={"Idempotency-Key": "revoke-confirmed"})
    assert revoked.status_code == 200
    for field in ("lifecycle", "actual_cod_minor", "allocation_basis", "completed_at", "expires_at", "portal_token"):
        assert revoked.json()[field] == before[field]
    assert (await client.get(f"/api/seller/transactions/{receipt['id']}")).json() == receipt_before
    assert (await client.get(f"/api/public/orders/{order['portal_token']}")).status_code == 410


@pytest.mark.asyncio
async def test_revocation_preserves_confirmed_allocation(client, seller_identity):
    await confirmed_order_revocation(client)


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{}, {"expected_version": True}, {"expected_version": 0},
                                    {"expected_version": 1, "lifecycle": "cancelled"}])
async def test_revocation_rejects_invalid_action_without_changing_access(client, seller_identity, payload):
    order = await _create_test_order(client)
    result = await client.post(f"/api/seller/orders/{order['id']}/revoke-link", json=payload, headers={"Idempotency-Key": "invalid"})
    assert result.status_code == 422
    assert (await client.get(f"/api/public/orders/{order['portal_token']}")).status_code == 200
