import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


async def exception_case(client, amount=150000):
    order = await _create_test_order(client)
    response = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={
        'buyer_name': 'Synthetic Buyer', 'contact_number': '01711111111',
        'address': {'raw_text': 'Synthetic Dhaka address'},
        'payment_claim': {'provider': 'bkash', 'trx_id': 'EXCEPTION',
                          'sender_number': '01822222222', 'amount_minor': 200000}},
        headers={'Idempotency-Key': 'exception-claim'})
    assert response.status_code == 200, response.text
    receipt = await client.post('/api/seller/transactions', json={
        'payment_account_id': order['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'EXCEPTION', 'amount_minor': amount}, headers={'Idempotency-Key': 'exception-receipt'})
    assert receipt.status_code == 201, receipt.text
    order = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    return order, receipt.json()


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_manual_exception_preview_acceptance_and_replay(client):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"
    preview = await client.get(path + '/payment-preview', params={'transaction_id': receipt['id']})
    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert data['actual_cod_minor'] == 1050000
    assert data['exceptions'] == ['AMOUNT_MISMATCH', 'SENDER_MISMATCH', 'TIME_UNCLEAR']
    assert data['blockers'] == []
    payload = {'action': 'confirm', 'expected_version': order['version'],
        'expected_transaction_version': receipt['version'], 'transaction_id': receipt['id'],
        'accepted_amount_minor': 150000, 'reason': 'Accepted actual advance from payment app'}
    result = await client.post(path + '/decisions', json=payload, headers={'Idempotency-Key': 'accept'})
    assert result.status_code == 200, result.text
    assert result.json()['lifecycle'] == 'confirmed'
    assert result.json()['allocation_basis'] == 'manual'
    assert result.json()['actual_cod_minor'] == 1050000
    assert (await client.post(path + '/decisions', json=payload, headers={'Idempotency-Key': 'accept'})).json() == result.json()
    public = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert public['actual_cod_minor'] == 1050000

@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('amount,cod', [(1,1199999),(250000,950000),(1200000,0)])
async def test_accept_full_actual_advance_up_to_total(client, amount, cod):
    order, receipt = await exception_case(client, amount)
    result = await client.post(f"/api/seller/orders/{order['id']}/decisions", json={
        'action': 'confirm', 'expected_version': order['version'], 'expected_transaction_version': receipt['version'],
        'transaction_id': receipt['id'], 'accepted_amount_minor': amount, 'reason': 'App amount accepted'},
        headers={'Idempotency-Key': 'amount'})
    assert result.status_code == 200, result.text
    assert result.json()['actual_cod_minor'] == cod


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('change,status', [({'reason':' '},422), ({'accepted_amount_minor':0},422),
    ({'accepted_amount_minor':True},422), ({'accepted_amount_minor':150000.1},422),
    ({'accepted_amount_minor':100000},422), ({'expected_version':999},409),
    ({'expected_transaction_version':999},409), ({'transaction_id':'foreign'},404)])
async def test_invalid_manual_decision_changes_nothing(client, change, status):
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"
    result = await client.post(path+'/decisions', json={'action':'confirm', 'expected_version':order['version'],
        'expected_transaction_version':receipt['version'], 'transaction_id':receipt['id'],
        'accepted_amount_minor':150000,'reason':'Checked app', **change}, headers={'Idempotency-Key':'invalid'})
    assert result.status_code == status, result.text
    assert (await client.get(path)).json() == order
    assert (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()['allocated_order_id'] is None


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_excessive_receipt_cannot_be_split_to_hide_overpayment(client):
    order, receipt = await exception_case(client, 1200001)
    path = f"/api/seller/orders/{order['id']}"
    preview = (await client.get(path+'/payment-preview', params={'transaction_id':receipt['id']})).json()
    assert preview['actual_cod_minor'] is None
    assert preview['blockers'] == ['PAYMENT_EXCEEDS_TOTAL']
    for amount in [1200001, 200000]:
        result = await client.post(path+'/decisions', json={'action':'confirm','expected_version':order['version'],
            'expected_transaction_version':receipt['version'],'transaction_id':receipt['id'],
            'accepted_amount_minor':amount,'reason':'Accept amount'}, headers={'Idempotency-Key':str(amount)})
        assert result.status_code == 409
        assert result.json()['error']['code'] == 'PAYMENT_EXCEEDS_TOTAL'
    assert (await client.get(path)).json() == order


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_unresolved_receipt_and_competing_claims_cannot_be_overridden(client):
    from test_resolution import conflict_case
    order, receipt = await conflict_case(client, competing=True)
    path = f"/api/seller/orders/{order['id']}"
    fresh = (await client.get(path)).json()
    preview = (await client.get(path+'/payment-preview', params={'transaction_id':receipt['id']})).json()
    assert preview['blockers'] == ['COMPETING_CLAIMS','CONFLICTING_RECEIPTS']
    result = await client.post(path+'/decisions', json={'action':'confirm','expected_version':fresh['version'],
        'expected_transaction_version':receipt['version'],'transaction_id':receipt['id'],
        'accepted_amount_minor':receipt['amount_minor'],'reason':'Cannot bypass'}, headers={'Idempotency-Key':'blocked'})
    assert result.status_code == 409
    assert (await client.get(path)).json() == fresh


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_decision_requires_owning_seller_receipt_and_key(client):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    order, receipt = await exception_case(client)
    path = f"/api/seller/orders/{order['id']}"
    payload = {'action':'confirm','expected_version':order['version'],'expected_transaction_version':receipt['version'],
        'transaction_id':receipt['id'],'accepted_amount_minor':150000,'reason':'Checked'}
    assert (await client.post(path+'/decisions',json=payload)).status_code == 422
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='foreign')
    await client.post('/api/seller/shop',json={'display_name':'Foreign shop'})
    foreign_order = await _create_test_order(client)
    assert (await client.get(path+'/payment-preview',params={'transaction_id':receipt['id']})).status_code == 404
    assert (await client.post(path+'/decisions',json=payload,headers={'Idempotency-Key':'foreign'})).status_code == 404
    foreign_path = f"/api/seller/orders/{foreign_order['id']}/payment-preview"
    assert (await client.get(foreign_path,params={'transaction_id':receipt['id']})).status_code == 404
    app.dependency_overrides.pop(get_seller_identity)
    assert (await client.post(path+'/decisions',json=payload,headers={'Idempotency-Key':'anonymous'})).status_code == 401

@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_committed_history_and_private_aggregates_do_not_double_count_replay(client):
    order, receipt = await exception_case(client)
    path=f"/api/seller/orders/{order['id']}"
    payload={'action':'confirm','expected_version':order['version'],'expected_transaction_version':receipt['version'],
        'transaction_id':receipt['id'],'accepted_amount_minor':150000,'reason':'Accepted missing sender and lower advance'}
    for _ in range(2):
        assert (await client.post(path+'/decisions',json=payload,headers={'Idempotency-Key':'history'})).status_code==200
    history=await client.get(path+'/payment-decisions')
    assert history.status_code==200
    assert len(history.json())==1
    event=history.json()[0]
    assert event['exceptions']==['AMOUNT_MISMATCH','SENDER_MISMATCH','TIME_UNCLEAR']
    assert event['reason']==payload['reason']
    assert event['actual_cod_minor']==1050000
    summary=(await client.get('/api/seller/payment-summary')).json()
    assert summary=={'confirmed_count':1,'manual_count':1,'exception_count':1}
    conflict=await client.post(path+'/decisions',json={**payload,'reason':'Changed'},headers={'Idempotency-Key':'history'})
    assert conflict.status_code==409
    assert (await client.get('/api/seller/payment-summary')).json()==summary

@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_provider_account_sender_and_time_exceptions_are_explicit(client):
    order, _ = await exception_case(client)
    account=(await client.post('/api/seller/payment-accounts',json={
        'provider':'nagad','receiving_number':'01912345678','label':'Other wallet'},
        headers={'Idempotency-Key':'other-account'})).json()
    receipt=(await client.post('/api/seller/transactions',json={
        'payment_account_id':account['id'],'provider':'nagad','trx_id':'EXCEPTION',
        'amount_minor':250000,'sender_number':'01933333333','occurred_at':'2020-01-01T00:00:00Z'},
        headers={'Idempotency-Key':'provider-exception'})).json()
    path=f"/api/seller/orders/{order['id']}"
    preview=(await client.get(path+'/payment-preview',params={'transaction_id':receipt['id']})).json()
    assert preview['exceptions']==['AMOUNT_MISMATCH','PROVIDER_MISMATCH','SENDER_MISMATCH','TIME_UNCLEAR','WRONG_RECEIVING_ACCOUNT']
    assert preview['blockers']==[]
    accepted=await client.post(path+'/decisions',json={'action':'confirm','expected_version':order['version'],
        'expected_transaction_version':receipt['version'],'transaction_id':receipt['id'],
        'accepted_amount_minor':250000,'reason':'App confirmed alternate wallet and payer'},headers={'Idempotency-Key':'provider'})
    assert accepted.status_code==200,accepted.text
    assert accepted.json()['actual_cod_minor']==950000
    assert (await client.get(path+'/payment-decisions')).json()[0]['exceptions']==preview['exceptions']
