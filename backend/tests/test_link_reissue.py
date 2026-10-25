"""Same-order link rotation preserves business history and remaining authority."""
import pytest
from buyer_postgres_support import PAYLOAD
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity

__all__ = ["clean_memory_stores", "seller_identity"]


@pytest.mark.asyncio
async def test_reissue_preserves_submission_and_retries_without_rotating(client, seller_identity):
    order = await _create_test_order(client)
    public = f"/api/public/orders/{order['portal_token']}"
    assert (await client.post(public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "submit"})).status_code == 200
    seller = f"/api/seller/orders/{order['id']}"
    before = (await client.get(seller)).json()
    payload, headers = {"expected_version": before["version"]}, {"Idempotency-Key": "rotate"}
    response = await client.post(seller + "/reissue-link", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    fresh = response.json()
    for field in ("id", "lifecycle", "expires_at", "total_minor", "required_advance_minor", "buyer_revision", "actual_cod_minor"):
        assert fresh[field] == before[field]
    assert fresh["portal_token"] != order["portal_token"]
    assert fresh["version"] == before["version"] + 1
    assert (await client.post(seller + "/reissue-link", json=payload, headers=headers)).json() == fresh
    assert (await client.get(public)).status_code == 404
    assert (await client.post(public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "submit"})).status_code == 404
    new_public = f"/api/public/orders/{fresh['portal_token']}"
    assert (await client.get(new_public)).status_code == 200
    assert (await client.post(new_public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "new-submit"})).status_code == 409
    assert (await client.post(seller + "/reissue-link", json=payload, headers={"Idempotency-Key": "stale"})).status_code == 409
    assert (await client.post(seller + "/revoke-link", json={"expected_version": fresh["version"]}, headers={"Idempotency-Key": "revoke"})).status_code == 200
    assert (await client.post(seller + "/reissue-link", json=payload, headers=headers)).status_code == 409
    assert (await client.get(new_public)).status_code == 410


@pytest.mark.asyncio
@pytest.mark.parametrize("state", ["expired", "cancelled", "replaced", "deadline"])
async def test_reissue_cannot_revive_ineligible_order(client, seller_identity, state):
    import datetime

    from app.services.order_service import _memory_orders
    order = await _create_test_order(client)
    raw = _memory_orders[order["id"]]
    if state == "replaced":
        raw["replaced_by_order_id"] = "replacement"
    elif state == "deadline":
        raw["expires_at"] = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=1)
    else:
        raw["lifecycle"] = state
    response = await client.post(f"/api/seller/orders/{order['id']}/reissue-link",
                                 json={"expected_version": 1}, headers={"Idempotency-Key": "rotate"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ORDER_NOT_REISSUABLE"
    assert raw["portal_token"] == order["portal_token"]


@pytest.mark.asyncio
async def test_reissue_recovers_revoked_access_and_supersedes_older_retry(client, seller_identity):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"
    assert (await client.post(path + "/revoke-link", json={"expected_version": 1}, headers={"Idempotency-Key": "revoke"})).status_code == 200
    payload, headers = {"expected_version": 2}, {"Idempotency-Key": "rotate"}
    first = await client.post(path + "/reissue-link", json=payload, headers=headers)
    assert first.status_code == 200
    assert first.json()["buyer_link_revoked_at"] is None
    assert (await client.get(f"/api/public/orders/{first.json()['portal_token']}")).status_code == 200
    second = await client.post(path + "/reissue-link", json={"expected_version": 3}, headers={"Idempotency-Key": "second"})
    assert second.status_code == 200
    assert (await client.post(path + "/reissue-link", json=payload, headers=headers)).status_code == 409
    assert (await client.get(f"/api/public/orders/{first.json()['portal_token']}")).status_code == 404
    assert (await client.get(path)).json()["portal_token"] == second.json()["portal_token"]
    changed = await client.post(path + "/reissue-link", json={"expected_version": 4}, headers=headers)
    assert changed.status_code == 409
    assert changed.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="foreign")
    assert (await client.post(path + "/reissue-link", json=payload, headers=headers)).status_code == 404
    app.dependency_overrides.pop(get_seller_identity)
    assert (await client.post(path + "/reissue-link", json=payload, headers=headers)).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{}, {"expected_version": True}, {"expected_version": 0},
                                    {"expected_version": 1, "expires_at": "later"}])
async def test_reissue_rejects_invalid_payload(client, seller_identity, payload):
    order = await _create_test_order(client)
    response = await client.post(f"/api/seller/orders/{order['id']}/reissue-link", json=payload,
                                 headers={"Idempotency-Key": "invalid"})
    assert response.status_code == 422
    assert (await client.get(f"/api/public/orders/{order['portal_token']}")).status_code == 200


async def confirmed_reissue(client):
    from test_payment_exceptions import exception_case
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"
    accepted = await client.post(path + "/decisions", json={
        "action": "confirm", "expected_version": order["version"],
        "expected_transaction_version": receipt["version"], "transaction_id": receipt["id"],
        "accepted_amount_minor": 150000, "reason": "Synthetic accepted advance",
    }, headers={"Idempotency-Key": "accept"})
    assert accepted.status_code == 200
    before = accepted.json()
    receipt_path = f"/api/seller/transactions/{receipt['id']}"
    receipt_before = (await client.get(receipt_path)).json()
    fresh = await client.post(path + "/reissue-link", json={"expected_version": before["version"]},
                             headers={"Idempotency-Key": "confirmed-rotate"})
    assert fresh.status_code == 200
    for field in ("id", "lifecycle", "actual_cod_minor", "allocation_basis", "completed_at", "buyer_revision", "expires_at"):
        assert fresh.json()[field] == before[field]
    assert (await client.get(receipt_path)).json() == receipt_before


@pytest.mark.asyncio
async def test_confirmed_allocation_survives_rotation(client, seller_identity):
    await confirmed_reissue(client)


@pytest.mark.asyncio
async def test_old_token_denies_every_public_operation_and_upload_replay(client, seller_identity):
    from tests.test_image_service import _create_minimal_png
    order = await _create_test_order(client)
    public = f"/api/public/orders/{order['portal_token']}"
    image = _create_minimal_png()
    headers = {"Idempotency-Key": "upload", "Content-Type": "image/png"}
    uploaded = await client.post(public + "/evidence", content=image, headers=headers)
    assert uploaded.status_code == 201
    fresh = await client.post(f"/api/seller/orders/{order['id']}/reissue-link",
                             json={"expected_version": 1}, headers={"Idempotency-Key": "rotate"})
    assert fresh.status_code == 200
    assert fresh.headers["cache-control"] == "no-store, private"
    assert fresh.headers["referrer-policy"] == "no-referrer"
    assert (await client.post(public + "/evidence", content=image, headers=headers)).status_code == 404
    for suffix, payload in (("address-extraction", {"raw_text": "Synthetic Dhaka address"}),
                            ("payment-extraction", {"evidence_id": uploaded.json()["evidence_id"]})):
        denied = await client.post(public + "/" + suffix, json={**payload, "ai_opt_in": True},
                                   headers={"Idempotency-Key": "extract"})
        assert denied.status_code == 404
    new_public = f"/api/public/orders/{fresh.json()['portal_token']}"
    assert (await client.post(new_public + "/submission", json=PAYLOAD, headers={"Idempotency-Key": "submit"})).status_code == 200
