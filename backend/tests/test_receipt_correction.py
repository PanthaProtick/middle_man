import pytest
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from test_resolution import conflict_case
from test_transaction_routes import clean_stores  # noqa: F401


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_correction_retains_evidence_and_commits_exact_match_and_replay(client):
    order, receipt = await conflict_case(client)
    path = f"/api/seller/transactions/{receipt['id']}"
    payload = {'expected_version': receipt['version'], 'reason': 'Checked payment app',
               'amount_minor': 200000}
    result = await client.patch(path, json=payload, headers={'Idempotency-Key': 'correct'})
    assert result.status_code == 200, result.text
    data = result.json()
    assert data['allocated_order_id'] == order['id']
    assert data['receipt']['observations'][:2] == receipt['observations']
    assert len(data['receipt']['observations']) == 3
    history = data['corrections'][0]
    assert history['before']['has_conflict'] is True
    assert history['after']['amount_minor'] == 200000
    assert history['reason'] == 'Checked payment app'
    assert history['observation_id'] == data['receipt']['observations'][-1]['id']
    assert (await client.get(path)).json() == data
    assert (await client.patch(path, json=payload, headers={'Idempotency-Key': 'correct'})).json() == data
    changed = await client.patch(path, json={**payload, 'reason': 'Other'}, headers={'Idempotency-Key': 'correct'})
    assert changed.status_code == 409
    assert (await client.get(f"/api/seller/orders/{order['id']}")).json()['actual_cod_minor'] == 1000000


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_identity_correction_retains_original_identity_and_rechecks_old_claims(client):
    _, receipt = await conflict_case(client, competing=True)
    path = f"/api/seller/transactions/{receipt['id']}"
    response = await client.patch(path, json={'expected_version': receipt['version'],
        'reason': 'Original TrxID was mistyped', 'trx_id': 'CORRECTED'}, headers={'Idempotency-Key': 'identity'})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data['receipt']['trx_id'] == 'CORRECTED'
    assert data['receipt']['observations'][0]['trx_id'] == 'RESOLVE'
    assert data['receipt']['observations'][-1]['trx_id'] == 'CORRECTED'
    assert data['corrections'][0]['before']['trx_id'] == 'RESOLVE'
    assert data['claims'] == []
    old = await client.post(path + '/resolve', json={'expected_version': data['receipt']['version'],
        'reason': 'Select original identity', 'selected_observation_id': receipt['observations'][0]['id']},
        headers={'Idempotency-Key': 'old-observation'})
    assert old.status_code == 409
    assert old.json()['error']['code'] == 'OBSERVATION_IDENTITY_CHANGED'
    orders = (await client.get('/api/seller/orders')).json()['items']
    assert all(o['review_reasons'] == [] for o in orders)


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('change,status,code', [
    ({'expected_version': 999}, 409, 'STALE_VERSION'),
    ({'reason': ' '}, 422, None), ({'amount_minor': None}, 422, None),
    ({'amount_minor': 0}, 422, None), ({'amount_minor': 1.5}, 422, None),
    ({'trx_id': ' '}, 422, 'INVALID_RECEIPT'),
    ({'sender_number': 'invalid'}, 422, 'INVALID_RECEIPT'),
    ({'occurred_at': '2026-10-24T12:00:00'}, 422, None),
    ({'provider': 'nagad'}, 422, 'PROVIDER_MISMATCH'),
    ({'payment_account_id': 'foreign'}, 404, 'NOT_FOUND'),
    ({'allocation': 'override'}, 422, None),
])
async def test_invalid_correction_is_atomic(client, change, status, code):
    _, receipt = await conflict_case(client)
    path = f"/api/seller/transactions/{receipt['id']}"
    before = (await client.get(path)).json()
    response = await client.patch(path, json={'expected_version': receipt['version'],
        'reason': 'Checked app', 'amount_minor': 200000, **change}, headers={'Idempotency-Key': 'invalid'})
    assert response.status_code == status, response.text
    if code:
        assert response.json()['error']['code'] == code
    assert (await client.get(path)).json() == before


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_identity_collision_requires_resolution_without_writes(client):
    _, receipt = await conflict_case(client)
    existing = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'EXISTING', 'amount_minor': 200000})
    assert existing.status_code == 201
    path = f"/api/seller/transactions/{receipt['id']}"
    before = (await client.get(path)).json()
    response = await client.patch(path, json={'expected_version': receipt['version'],
        'reason': 'Wrong TrxID', 'trx_id': ' EXISTING '}, headers={'Idempotency-Key': 'collision'})
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'RECEIPT_IDENTITY_COLLISION'
    assert (await client.get(path)).json() == before
    assert len((await client.get('/api/seller/transactions')).json()['items']) == 2


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_correction_preserves_competing_claim_rules_and_locks_accepted_fields(client):
    order, receipt = await conflict_case(client, competing=True)
    path = f"/api/seller/transactions/{receipt['id']}"
    corrected = await client.patch(path, json={'expected_version': receipt['version'],
        'reason': 'App amount checked', 'amount_minor': 200000}, headers={'Idempotency-Key': 'competing'})
    assert corrected.status_code == 200
    data = corrected.json()
    assert data['allocated_order_id'] is None
    assert all(c['lifecycle'] == 'pending' and 'COMPETING_CLAIMS' in c['review_reasons'] for c in data['claims'])
    resolved = await client.post(path + '/resolve', json={'expected_version': data['receipt']['version'],
        'reason': 'Compared both orders', 'selected_order_id': order['id'],
        'selected_observation_id': data['receipt']['observations'][-1]['id']}, headers={'Idempotency-Key': 'choose'})
    assert resolved.status_code == 200
    locked = resolved.json()
    response = await client.patch(path, json={'expected_version': locked['receipt']['version'],
        'reason': 'Cannot change used payment', 'amount_minor': 1}, headers={'Idempotency-Key': 'locked'})
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'PAYMENT_USED'
    assert (await client.get(path)).json() == locked


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_correction_requires_owning_seller_and_key(client):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    _, receipt = await conflict_case(client)
    path = f"/api/seller/transactions/{receipt['id']}"
    payload = {'expected_version': receipt['version'], 'reason': 'Checked', 'amount_minor': 200000}
    assert (await client.patch(path, json=payload)).status_code == 422
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='foreign-seller')
    await client.post('/api/seller/shop', json={'display_name': 'Foreign shop'})
    assert (await client.patch(path, json=payload, headers={'Idempotency-Key': 'foreign'})).status_code == 404
    app.dependency_overrides.pop(get_seller_identity)
    assert (await client.patch(path, json=payload, headers={'Idempotency-Key': 'anonymous'})).status_code == 401
