"""Real production gate with offline storage and controlled server time."""
import datetime

import pytest
from buyer_postgres_support import PAYLOAD
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity

from app.api.public_orders import get_buyer_clock
from app.core import public_gate
from app.core.auth import get_seller_identity
from app.core.config import Settings
from app.main import app

__all__ = ["clean_memory_stores", "seller_identity"]


@pytest.fixture(autouse=True)
def production_gate(clean_memory_stores, monkeypatch):
    app.dependency_overrides.pop(public_gate.verify_public_access_gate, None)
    monkeypatch.setattr(public_gate, "settings", Settings(
        ENV="production", PRODUCTION_BUYER_ACCESS_POLICY="link_possession",
    ))


async def test_submission_replay_rotation_revocation_and_private_authority(client, seller_identity):
    order = await _create_test_order(client)
    public = f"/api/public/orders/{order['portal_token']}"
    seller = f"/api/seller/orders/{order['id']}"
    headers = {"Idempotency-Key": "submit"}
    first = await client.post(public + "/submission", json=PAYLOAD, headers=headers)
    assert first.status_code == 200
    assert (await client.post(public + "/submission", json=PAYLOAD, headers=headers)).json() == first.json()
    assert (await client.post(public + "/submission", json=PAYLOAD,
                              headers={"Idempotency-Key": "correction"})).status_code == 409

    # A submitted order retains public status beyond its initial submission deadline.
    after_deadline = datetime.datetime.fromisoformat(order["expires_at"].replace("Z", "+00:00")) + datetime.timedelta(days=1)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: after_deadline
    assert (await client.get(public)).json()["lifecycle"] == "pending"
    before = (await client.get(seller)).json()
    fresh = await client.post(seller + "/reissue-link", json={"expected_version": before["version"]},
                              headers={"Idempotency-Key": "rotate"})
    assert fresh.status_code == 200
    for field in ("id", "expires_at", "lifecycle", "buyer_revision", "actual_cod_minor"):
        assert fresh.json()[field] == before[field]
    for response in (
        await client.get(public),
        await client.post(public + "/submission", json=PAYLOAD, headers=headers),
    ):
        assert response.status_code == 404
        assert fresh.json()["portal_token"] not in response.text
    current = f"/api/public/orders/{fresh.json()['portal_token']}"
    assert (await client.get(current)).json()["lifecycle"] == "pending"
    revoked = await client.post(seller + "/revoke-link", json={"expected_version": fresh.json()["version"]},
                                headers={"Idempotency-Key": "revoke"})
    assert revoked.status_code == 200
    assert (await client.get(current)).status_code == 410
    assert (await client.post(current + "/submission", json=PAYLOAD, headers=headers)).status_code == 410

    app.dependency_overrides.pop(get_seller_identity)
    for suffix in ("", "/history"):
        assert (await client.get(seller + suffix, headers={"Authorization": f"Bearer {order['portal_token']}"})).status_code == 401
    assert (await client.patch(seller + "/buyer-details", json={},
                               headers={"Idempotency-Key": "private"})).status_code == 401


async def test_expired_initial_submission_is_rejected_without_private_data(client, seller_identity):
    order = await _create_test_order(client)
    deadline = datetime.datetime.fromisoformat(order["expires_at"].replace("Z", "+00:00"))
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: deadline
    public = f"/api/public/orders/{order['portal_token']}"
    assert (await client.get(public)).json()["lifecycle"] == "expired"
    response = await client.post(public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "expired"})
    assert response.status_code == 410
    assert response.json()["error"]["code"] == "EXPIRED_SUBMISSION"


async def test_revocation_blocks_committed_submission_replay(client, seller_identity):
    order = await _create_test_order(client)
    public = f"/api/public/orders/{order['portal_token']}"
    headers = {"Idempotency-Key": "committed"}
    assert (await client.post(public + "/submission", json=PAYLOAD, headers=headers)).status_code == 200
    seller = f"/api/seller/orders/{order['id']}"
    before = (await client.get(seller)).json()
    assert (await client.post(seller + "/revoke-link", json={"expected_version": before["version"]},
                              headers={"Idempotency-Key": "revoke"})).status_code == 200
    denied = await client.post(public + "/submission", json=PAYLOAD, headers=headers)
    assert denied.status_code == 410
    assert denied.json()["error"]["code"] == "BUYER_LINK_REVOKED"
