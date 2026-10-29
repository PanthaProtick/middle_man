import pytest
from test_payment_exceptions import exception_case
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_decision_stale_version_and_blank_reason(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Stale version
    stale_payload = {
        "action": "cancel",
        "expected_version": 999,
        "reason": "Wrong version test",
    }
    res = await client.post(path + "/decisions", json=stale_payload, headers={"Idempotency-Key": "stale-1"})
    assert res.status_code == 409
    assert "STALE_VERSION" in res.text or "changed" in res.text.lower()

    # Blank reason
    blank_payload = {
        "action": "cancel",
        "expected_version": order["version"],
        "reason": "   ",
    }
    res2 = await client.post(path + "/decisions", json=blank_payload, headers={"Idempotency-Key": "blank-1"})
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_decision_shop_isolation(client):
    # Setup Shop A
    seller_a = SellerIdentity(owner_id="owner_a")
    app.dependency_overrides[get_seller_identity] = lambda: seller_a
    order = await _create_test_order(client)

    # Switch to Shop B
    seller_b = SellerIdentity(owner_id="owner_b")
    app.dependency_overrides[get_seller_identity] = lambda: seller_b
    await client.post(
        "/api/seller/shop",
        json={"display_name": "Shop B"},
        headers={"Idempotency-Key": "setup-shop-b"},
    )

    path = f"/api/seller/orders/{order['id']}"
    res = await client.post(
        path + "/decisions",
        json={
            "action": "cancel",
            "expected_version": 1,
            "reason": "Cross shop cancellation attempt",
        },
        headers={"Idempotency-Key": "cross-shop-1"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_decision_idempotency_replay_and_conflict(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"
    payload = {"action": "cancel", "expected_version": order["version"], "reason": "Customer changed mind"}
    res1 = await client.post(path + "/decisions", json=payload, headers={"Idempotency-Key": "idem-cancel"})
    assert res1.status_code == 200
    res2 = await client.post(path + "/decisions", json=payload, headers={"Idempotency-Key": "idem-cancel"})
    assert res2.status_code == 200
    assert res2.json() == res1.json()

    # Different payload with same mutation key
    diff_payload = {"action": "cancel", "expected_version": order["version"], "reason": "Different reason"}
    res3 = await client.post(path + "/decisions", json=diff_payload, headers={"Idempotency-Key": "idem-cancel"})
    assert res3.status_code == 409


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_decision_cross_action_idempotency_conflict(client):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"

    # First call: confirm
    conf_payload = {
        'action': 'confirm',
        'expected_version': order['version'],
        'expected_transaction_version': receipt['version'],
        'transaction_id': receipt['id'],
        'accepted_amount_minor': 150000,
        'reason': 'Confirming advance',
    }
    res1 = await client.post(path + '/decisions', json=conf_payload, headers={'Idempotency-Key': 'shared-decision-key'})
    assert res1.status_code == 200

    # Second call with SAME key but different action (cancel)
    cancel_payload = {
        'action': 'cancel',
        'expected_version': order['version'],
        'reason': 'Attempt to cancel with same idempotency key',
    }
    res2 = await client.post(path + '/decisions', json=cancel_payload, headers={'Idempotency-Key': 'shared-decision-key'})
    assert res2.status_code == 409
