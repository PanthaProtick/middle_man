import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_replace_stale_version_and_blank_reason(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Stale version
    payload_stale = {
        "expected_version": 999,
        "reason": "Replacement test",
        "order": {
            "product_name": "New Product",
            "total_minor": 1400000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res = await client.post(path + "/replacement", json=payload_stale, headers={"Idempotency-Key": "replace-stale"})
    assert res.status_code == 409

    # Blank reason
    payload_blank = {
        "expected_version": order["version"],
        "reason": "   ",
        "order": {
            "product_name": "New Product",
            "total_minor": 1400000,
            "required_advance_minor": 200000,
            "payment_account_id": order["payment_account_id"],
        },
    }
    res2 = await client.post(path + "/replacement", json=payload_blank, headers={"Idempotency-Key": "replace-blank"})
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_replace_cross_shop_isolation(client):
    seller_a = SellerIdentity(owner_id="owner_a_replace")
    app.dependency_overrides[get_seller_identity] = lambda: seller_a
    order = await _create_test_order(client)

    seller_b = SellerIdentity(owner_id="owner_b_replace")
    app.dependency_overrides[get_seller_identity] = lambda: seller_b
    await client.post(
        "/api/seller/shop",
        json={"display_name": "Shop B Replacement"},
        headers={"Idempotency-Key": "setup-shop-b-replace"},
    )

    path = f"/api/seller/orders/{order['id']}"
    res = await client.post(
        path + "/replacement",
        json={
            "expected_version": 1,
            "reason": "Unauthorized cross shop replacement",
            "order": {
                "product_name": "Hacked Product",
                "total_minor": 1400000,
                "required_advance_minor": 200000,
                "payment_account_id": order["payment_account_id"],
            },
        },
        headers={"Idempotency-Key": "cross-replace-1"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_replace_rejected_or_cancelled_order_forbidden(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Cancel order
    cancel_res = await client.post(path + '/decisions', json={
        'action': 'cancel',
        'expected_version': 1,
        'reason': 'Cancelled first',
    }, headers={'Idempotency-Key': 'cancel-before-replace'})
    assert cancel_res.status_code == 200

    # Cannot replace an already cancelled order
    res = await client.post(path + '/replacement', json={
        'expected_version': 2,
        'reason': 'Replace cancelled order',
        'order': {
            'product_name': 'Replacement',
            'total_minor': 1300000,
            'required_advance_minor': 200000,
            'payment_account_id': order['payment_account_id'],
        },
    }, headers={'Idempotency-Key': 'replace-cancelled'})
    assert res.status_code == 409
    assert 'INVALID_LIFECYCLE' in res.text


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_replace_expired_order_preserves_expired_lifecycle(client):
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"

    # Expire the order manually in store
    from app.services.order_service import _memory_orders
    _memory_orders[order['id']]['lifecycle'] = 'expired'
    _memory_orders[order['id']]['version'] = 2

    res = await client.post(path + '/replacement', json={
        'expected_version': 2,
        'reason': 'Customer requested new link after expiry',
        'order': {
            'product_name': 'Replacement For Expired',
            'total_minor': 1300000,
            'required_advance_minor': 200000,
            'payment_account_id': order['payment_account_id'],
        },
    }, headers={'Idempotency-Key': 'replace-expired'})
    assert res.status_code == 201
    new_order = res.json()

    # Predecessor order remains expired (does not become cancelled)
    old_order = (await client.get(path)).json()
    assert old_order['lifecycle'] == 'expired'
    assert old_order['replaced_by_order_id'] == new_order['id']
