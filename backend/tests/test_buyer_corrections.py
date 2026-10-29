import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_pending_delivery_correction_preserves_claim_time_and_history(client):
    order = await _create_test_order(client)
    submission = {'buyer_name': 'Buyer', 'contact_number': '01711111111',
                  'address': {'raw_text': 'Dhaka'}, 'payment_claim': {'provider': 'bkash',
                  'trx_id': 'CORRECT', 'sender_number': '01822222222', 'amount_minor': 200000}}
    assert (await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=submission,
                             headers={'Idempotency-Key': 'submit'})).status_code == 200
    path = f"/api/seller/orders/{order['id']}"
    before = await client.get(path + '/history')
    assert before.status_code == 200
    first = before.json()['items'][0]
    result = await client.patch(path + '/buyer-details', json={
        'expected_version': 2, 'reason': 'Correct delivery name', 'buyer_name': 'Correct Buyer'},
        headers={'Idempotency-Key': 'correction'})
    assert result.status_code == 200
    assert result.json()['lifecycle'] == 'pending'
    history = (await client.get(path + '/history')).json()['items']
    assert len(history) == 2
    assert history[0] == first
    assert history[1]['buyer_name'] == 'Correct Buyer'
    assert history[1]['claim_accepted_at'] == first['claim_accepted_at']
    assert history[1]['reason'] == 'Correct delivery name'
    assert history[1]['actor'] != 'buyer'
    stale = await client.patch(path + '/buyer-details', json={
        'expected_version': 2, 'reason': 'Stale correction', 'buyer_name': 'Lost update'},
        headers={'Idempotency-Key': 'stale'})
    assert stale.status_code == 409


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_confirmed_delivery_correction_cannot_change_payment(client):
    from test_resolution import conflict_case
    order, receipt = await conflict_case(client)
    comparison = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
    result = await client.post(f"/api/seller/transactions/{receipt['id']}/resolve", json={
        'expected_version': comparison['receipt']['version'], 'selected_observation_id': receipt['observations'][0]['id'],
        'reason': 'Select exact receipt'}, headers={'Idempotency-Key': 'resolve'})
    assert result.status_code == 200
    path = f"/api/seller/orders/{order['id']}"
    confirmed = (await client.get(path)).json()
    assert confirmed['lifecycle'] == 'confirmed'
    delivery = await client.patch(path + '/buyer-details', json={'expected_version': confirmed['version'],
        'reason': 'Fix contact', 'contact_number': '01911111111'}, headers={'Idempotency-Key': 'delivery'})
    assert delivery.status_code == 200
    assert delivery.json()['actual_cod_minor'] == confirmed['actual_cod_minor']
    locked = await client.patch(path + '/buyer-details', json={'expected_version': delivery.json()['version'],
        'reason': 'Change payment', 'payment_claim': {'provider': 'bkash', 'trx_id': 'NEW',
            'sender_number': '01822222222', 'amount_minor': 200000}}, headers={'Idempotency-Key': 'locked'})
    assert locked.status_code == 409


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_payment_correction_uses_new_acceptance_bound_and_rechecks(client):
    import datetime

    from app.api.public_orders import get_buyer_clock
    from app.main import app
    order = await _create_test_order(client)
    created = datetime.datetime.fromisoformat(order['created_at'])
    first_time = created + datetime.timedelta(seconds=1)
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: first_time
    claim = {'provider': 'bkash', 'trx_id': 'WRONG', 'sender_number': '01822222222', 'amount_minor': 200000}
    await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={
        'buyer_name': 'Buyer', 'contact_number': '01711111111', 'address': {'raw_text': 'Dhaka'},
        'payment_claim': claim}, headers={'Idempotency-Key': 'submit'})
    when = created + datetime.timedelta(seconds=2)
    receipt = await client.post('/api/seller/transactions', json={
        'payment_account_id': order['payment_account_id'], 'provider': 'bkash', 'trx_id': 'CORRECT',
        'sender_number': '01822222222', 'amount_minor': 200000, 'occurred_at': when.isoformat()},
        headers={'Idempotency-Key': 'receipt'})
    assert receipt.status_code == 201
    path = f"/api/seller/orders/{order['id']}"
    from unittest.mock import patch
    correction_time = created + datetime.timedelta(days=4)
    with patch('app.services.buyer_correction.get_utc_now', return_value=correction_time):
        result = await client.patch(path + '/buyer-details', json={'expected_version': 2,
            'reason': 'Fix transaction', 'payment_claim': {**claim, 'trx_id': 'CORRECT'}},
            headers={'Idempotency-Key': 'correct'})
    assert result.status_code == 200
    assert result.json()['lifecycle'] == 'confirmed'
    assert result.json()['actual_cod_minor'] == 1000000
    revisions = (await client.get(path + '/history')).json()['items']
    assert datetime.datetime.fromisoformat(revisions[0]['claim_accepted_at']) == first_time
    assert datetime.datetime.fromisoformat(revisions[1]['claim_accepted_at']) == correction_time
    replay = await client.patch(path + '/buyer-details', json={'expected_version': 2,
        'reason': 'Fix transaction', 'payment_claim': {**claim, 'trx_id': 'CORRECT'}},
        headers={'Idempotency-Key': 'correct'})
    assert replay.json() == result.json()
    assert len((await client.get(path + '/history')).json()['items']) == 2


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_correction_and_history_require_seller_and_shop_authority(client):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    order = await _create_test_order(client)
    path = f"/api/seller/orders/{order['id']}"
    payload = {'expected_version': 1, 'reason': 'Unauthorized', 'buyer_name': 'Other'}
    app.dependency_overrides.pop(get_seller_identity)
    for method, suffix in [('get', '/history'), ('patch', '/buyer-details')]:
        response = await getattr(client, method)(path + suffix, **({'json': payload,
            'headers': {'Idempotency-Key': 'unauthorized'}} if method == 'patch' else {}))
        assert response.status_code == 401
        assert response.headers['cache-control'] == 'no-store, private'
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='other-seller')
    await client.post('/api/seller/shop', json={'display_name': 'Other shop'}, headers={'Idempotency-Key': 'other'})
    assert (await client.get(path + '/history')).status_code == 404
    assert (await client.patch(path + '/buyer-details', json=payload, headers={'Idempotency-Key': 'other'})).status_code == 404
    assert (await client.post('/api/seller/order-links/resolve', json={'portal_token': order['portal_token']})).status_code == 404


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('changes', [
    {'buyer_name': '   '}, {'buyer_name': 'x' * 201}, {'contact_number': 'invalid'},
    {'address': None}, {'payment_claim': None}, {'total_minor': 1}, {},
])
async def test_invalid_corrections_are_request_validation_errors(client, changes):
    order = await _create_test_order(client)
    result = await client.patch(f"/api/seller/orders/{order['id']}/buyer-details", json={
        'expected_version': 1, 'reason': 'Fix', **changes}, headers={'Idempotency-Key': 'invalid'})
    assert result.status_code == 422


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_changing_claim_identity_removes_obsolete_review_reasons(client):
    from test_resolution import conflict_case
    order, _ = await conflict_case(client)
    path = f"/api/seller/orders/{order['id']}"
    before = (await client.get(path)).json()
    assert before['review_reasons'] == ['CONFLICTING_RECEIPTS']
    result = await client.patch(path + '/buyer-details', json={'expected_version': before['version'],
        'reason': 'Different payment', 'payment_claim': {'provider': 'bkash', 'trx_id': 'NOT-RECEIVED',
            'sender_number': '01822222222', 'amount_minor': 200000}}, headers={'Idempotency-Key': 'new-identity'})
    assert result.status_code == 200
    assert result.json()['review_reasons'] == []


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_confirmed_delivery_correction_comprehensive_invariants(client):
    from test_resolution import conflict_case
    order, receipt = await conflict_case(client)
    comparison = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
    res = await client.post(
        f"/api/seller/transactions/{receipt['id']}/resolve",
        json={
            'expected_version': comparison['receipt']['version'],
            'selected_observation_id': receipt['observations'][0]['id'],
            'reason': 'Select exact receipt',
        },
        headers={'Idempotency-Key': 'resolve-for-invariants'},
    )
    assert res.status_code == 200

    path = f"/api/seller/orders/{order['id']}"
    confirmed = (await client.get(path)).json()
    assert confirmed['lifecycle'] == 'confirmed'
    assert confirmed['completed_at'] is not None

    receipt_before = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()['receipt']

    # 1. Delivery-only correction: updates name, contact, address
    delivery = await client.patch(
        path + '/buyer-details',
        json={
            'expected_version': confirmed['version'],
            'reason': 'Customer requested new shipping address',
            'buyer_name': 'Updated Recipient',
            'contact_number': '01922222222',
            'address': {'raw_text': 'House 10, Road 5, Dhanmondi, Dhaka', 'district': 'Dhaka'},
        },
        headers={'Idempotency-Key': 'delivery-correction-1'},
    )
    assert delivery.status_code == 200
    updated = delivery.json()

    # Commercial terms, balance, allocation, and completion time are strictly unchanged
    assert updated['lifecycle'] == 'confirmed'
    assert updated['total_minor'] == confirmed['total_minor']
    assert updated['required_advance_minor'] == confirmed['required_advance_minor']
    assert updated['expected_cod_minor'] == confirmed['expected_cod_minor']
    assert updated['actual_cod_minor'] == confirmed['actual_cod_minor']
    assert updated['allocation_basis'] == confirmed['allocation_basis']
    assert updated['completed_at'] == confirmed['completed_at']
    assert updated['version'] == confirmed['version'] + 1
    assert updated['buyer_revision'] == confirmed['buyer_revision'] + 1

    # Receipt allocation/version remains untouched on delivery-only correction
    receipt_after = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()['receipt']
    assert receipt_after['version'] == receipt_before['version']

    # 2. History verification
    history_resp = await client.get(path + '/history')
    assert history_resp.status_code == 200
    items = history_resp.json()['items']
    assert len(items) == 2
    rev1, rev2 = items[0], items[1]
    assert rev2['revision_number'] == 2
    assert rev2['buyer_name'] == 'Updated Recipient'
    assert rev2['contact_number'] == '01922222222'
    assert rev2['address']['raw_text'] == 'House 10, Road 5, Dhanmondi, Dhaka'
    assert rev2['address']['district'] == 'Dhaka'
    assert rev2['reason'] == 'Customer requested new shipping address'
    assert rev2['claim_accepted_at'] == rev1['claim_accepted_at']
    assert rev2['payment_claim'] == rev1['payment_claim']

    # 3. Public projection privacy: no personal fields leaked, status remains confirmed
    public_resp = await client.get(f"/api/public/orders/{confirmed['portal_token']}")
    assert public_resp.status_code == 200
    pub_data = public_resp.json()
    assert pub_data['lifecycle'] == 'confirmed'
    assert pub_data['actual_cod_minor'] == confirmed['actual_cod_minor']
    assert 'buyer_name' not in pub_data
    assert 'contact_number' not in pub_data
    assert 'address' not in pub_data
    assert 'payment_claim' not in pub_data

    # 4. Public re-submission rejected on confirmed order
    sub_resp = await client.post(
        f"/api/public/orders/{confirmed['portal_token']}/submission",
        json={
            'buyer_name': 'Hacker',
            'contact_number': '01700000000',
            'address': {'raw_text': 'Nowhere'},
            'payment_claim': {
                'provider': 'bkash',
                'trx_id': 'FAKE',
                'sender_number': '01800000000',
                'amount_minor': 200000,
            },
        },
        headers={'Idempotency-Key': 'public-resubmit-attempt'},
    )
    assert sub_resp.status_code == 409
    assert sub_resp.json()['error']['code'] == 'ORDER_ALREADY_SUBMITTED'

    # 5. Extra/forbidden fields rejected with 422
    for forbidden in [
        {'courier_booking_id': 'PATHAO-123'},
        {'courier_status': 'dispatched'},
        {'actual_cod_minor': 50000},
        {'total_minor': 500000},
    ]:
        bad_req = await client.patch(
            path + '/buyer-details',
            json={
                'expected_version': updated['version'],
                'reason': 'Forbidden extra field attempt',
                'buyer_name': 'Another Name',
                **forbidden,
            },
            headers={'Idempotency-Key': 'extra-field-attempt'},
        )
        assert bad_req.status_code == 422
