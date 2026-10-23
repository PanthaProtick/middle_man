import datetime

import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401


async def conflict_case(client, competing=False):
    order = await _create_test_order(client)
    rival = None
    if competing:
        rival_response = await client.post('/api/seller/orders', json={
            'product_name': 'Other order', 'total_minor': 1200000, 'required_advance_minor': 200000,
            'payment_account_id': order['payment_account_id']}, headers={'Idempotency-Key': 'other-order'})
        assert rival_response.status_code == 201
        rival = rival_response.json()
    when = datetime.datetime.now(datetime.timezone.utc).isoformat()
    claim = {'buyer_name': 'Synthetic Buyer', 'contact_number': '01711111111',
             'address': {'raw_text': 'Synthetic Dhaka address'},
             'payment_claim': {'provider': 'bkash', 'trx_id': 'RESOLVE',
                               'sender_number': '01822222222', 'amount_minor': 200000}}
    assert (await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=claim,
                             headers={'Idempotency-Key': 'claim'})).status_code == 200
    if rival:
        assert (await client.post(f"/api/public/orders/{rival['portal_token']}/submission", json=claim,
                                 headers={'Idempotency-Key': 'rival-claim'})).status_code == 200
    payload = {'payment_account_id' : order['payment_account_id'], 'messages': [
        f'bKash: You have received Tk 2000.00 from 01822222222. TrxID RESOLVE at {when}',
        f'bKash: You have received Tk 2001.00 from 01822222222. TrxID RESOLVE at {when}']}
    imported = await client.post('/api/seller/transactions/sms-import', json=payload,
                                headers={'Idempotency-Key': 'batch'})
    assert imported.status_code == 200
    receipt = (await client.get('/api/seller/transactions')).json()['items'][0]
    return order, receipt


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_select_observation_preserves_history_and_confirms_exact_match(client):
    order, receipt = await conflict_case(client)
    path = f"/api/seller/transactions/{receipt['id']}"
    compare = await client.get(path)
    assert compare.status_code == 200
    assert compare.json()['claims'][0]['review_reasons'] == ['CONFLICTING_RECEIPTS']
    decision = {'expected_version': receipt['version'], 'reason': 'Checked payment app',
                'selected_observation_id': receipt['observations'][0]['id']}
    result = await client.post(path + '/resolve', json=decision, headers={'Idempotency-Key': 'decision'})
    assert result.status_code == 200, result.text
    assert len(result.json()['receipt']['observations']) == 2
    assert result.json()['allocated_order_id'] == order['id']
    assert result.json()['history'][0]['reason'] == 'Checked payment app'
    again = await client.post(path + '/resolve', json=decision, headers={'Idempotency-Key': 'decision'})
    assert again.json() == result.json()
    assert (await client.get(f"/api/seller/orders/{order['id']}")).json()['actual_cod_minor'] == 1000000


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_explicit_competing_decision_holds_other_claim_and_locks_allocation(client):
    order, receipt = await conflict_case(client, competing=True)
    path = f"/api/seller/transactions/{receipt['id']}"
    before = (await client.get(path)).json()
    assert len(before['claims']) == 2
    assert all(c['lifecycle'] == 'pending' for c in before['claims'])
    decision = {'expected_version': receipt['version'], 'reason': 'Compared both orders with buyer',
                'selected_observation_id': receipt['observations'][0]['id'], 'selected_order_id': order['id']}
    result = await client.post(path + '/resolve', json=decision, headers={'Idempotency-Key': 'select-order'})
    assert result.status_code == 200, result.text
    data = result.json()
    assert data['allocated_order_id'] == order['id']
    other = next(c for c in data['claims'] if c['order_id'] != order['id'])
    assert other['lifecycle'] == 'pending'
    assert other['held_by_resolution']
    assert 'COMPETING_CLAIMS' in other['review_reasons']
    decision['expected_version'] = data['receipt']['version']
    decision['selected_order_id'] = other['order_id']
    assert (await client.post(path + '/resolve', json=decision,
                             headers={'Idempotency-Key': 'cannot-transfer'})).status_code == 409
    late = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash', 'trx_id': 'RESOLVE',
        'amount_minor': 199999, 'sender_number': '01822222222', 'occurred_at': receipt['occurred_at']})
    assert late.status_code == 200
    assert late.json()['reconciliation_state'] == 'used'
    after = (await client.get(path)).json()
    assert after['allocated_order_id'] == order['id']
    assert after['receipt']['has_conflict']


@pytest.mark.asyncio
@pytest.mark.parametrize('change,code', [({'reason': '  '}, 422), ({'amount_minor': 200000}, 422),
    ({'expected_version': 999}, 409), ({'selected_order_id': 'unknown'}, 409),
    ({'selected_observation_id': 'unknown'}, 422)])
@pytest.mark.usefixtures("seller_identity")
async def test_resolution_rejects_invalid_stale_and_override_writes(client, change, code):
    _, receipt = await conflict_case(client)
    decision = {'expected_version': receipt['version'], 'reason': 'Reviewed',
                'selected_observation_id': receipt['observations'][0]['id'], **change}
    result = await client.post(f"/api/seller/transactions/{receipt['id']}/resolve", json=decision,
                              headers={'Idempotency-Key': 'invalid'})
    assert result.status_code == code
    assert (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()['allocated_order_id'] is None


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_resolution_never_overrides_exact_amount_checks(client):
    _, receipt = await conflict_case(client, competing=True)
    decision = {'expected_version': receipt['version'], 'reason': 'Selected different received value',
                'selected_observation_id': receipt['observations'][1]['id']}
    path = f"/api/seller/transactions/{receipt['id']}"
    result = await client.post(path + '/resolve', json=decision, headers={'Idempotency-Key': 'mismatch'})
    assert result.status_code == 200
    assert result.json()['allocated_order_id'] is None
    assert all(c['lifecycle'] == 'pending' and 'AMOUNT_MISMATCH' in c['review_reasons'] for c in result.json()['claims'])


@pytest.mark.asyncio
@pytest.mark.usefixtures("seller_identity")
async def test_comparison_and_decision_are_private_to_owning_seller(client):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    _, receipt = await conflict_case(client)
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='different-owner')
    await client.post('/api/seller/shop', json={'display_name': 'Other shop'})
    path = f"/api/seller/transactions/{receipt['id']}"
    assert (await client.get(path)).status_code == 404
    assert (await client.post(path + '/resolve', json={'expected_version': receipt['version'], 'reason': 'Invalid',
        'selected_observation_id': receipt['observations'][0]['id']},
        headers={'Idempotency-Key': 'foreign'})).status_code == 404
