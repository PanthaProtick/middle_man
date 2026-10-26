"""Seller-only local courier proposals through the HTTP boundary."""
import pytest
from test_payment_exceptions import exception_case
from test_payment_exceptions_postgres import decision
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401


async def parcel_order(client, key: str, **parcel) -> dict:
    base = await _create_test_order(client)
    response = await client.post('/api/seller/orders', json={
        'product_name': 'Parcel order', 'total_minor': 1200000, 'required_advance_minor': 200000,
        'payment_account_id': base['payment_account_id'], **parcel,
    }, headers={'Idempotency-Key': key})
    assert response.status_code == 201, response.text
    return response.json()


async def confirm_automatically(client, order, transaction_id: str) -> None:
    receipt = await client.post('/api/seller/transactions', json={
        'payment_account_id': order['payment_account_id'], 'provider': 'bkash',
        'trx_id': transaction_id, 'amount_minor': 200000, 'sender_number': '01822222222',
        'occurred_at': order['created_at'],
    }, headers={'Idempotency-Key': f'receipt-{transaction_id}'})
    assert receipt.status_code == 201, receipt.text
    claim = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={
        'buyer_name': 'Parcel Buyer', 'contact_number': '01711111111',
        'address': {'raw_text': 'Parcel address, Dhaka'},
        'payment_claim': {'provider': 'bkash', 'trx_id': transaction_id,
                          'sender_number': '01822222222', 'amount_minor': 200000},
    }, headers={'Idempotency-Key': f'claim-{transaction_id}'})
    assert claim.status_code == 200, claim.text
    assert (await client.get(f"/api/seller/orders/{order['id']}")).json()['lifecycle'] == 'confirmed'


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('amount,cod', [(150000, 1050000), (1200000, 0)])
async def test_manual_draft_uses_contact_and_accepted_advance(client, amount, cod):
    order, receipt = await exception_case(client, amount)
    path = f"/api/seller/orders/{order['id']}/courier-draft"
    assert (await client.get(path)).status_code == 404
    assert (await decision(client, order, receipt)).status_code == 200
    response = await client.get(path)
    assert response.status_code == 200, response.text
    draft = response.json()
    assert draft['recipient_name'] == 'Synthetic Buyer'
    assert draft['contact_number'] == '01711111111'
    assert draft['address'] == 'Synthetic Dhaka address'
    assert draft['remaining_cod_minor'] == cod
    assert draft['status'] == 'local_proposal'
    assert draft['blockers'] == ['PARCEL_DETAILS_REQUIRED', 'COURIER_CONNECTION_REQUIRED', 'LOCATION_METADATA_REQUIRED']
    assert 'no-store' in response.headers['cache-control']
    assert (await decision(client, order, receipt)).status_code == 200
    assert (await client.get(path)).json() == draft
    public = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert 'courier_draft' not in public and 'recipient_name' not in public


@pytest.mark.usefixtures('seller_identity')
async def test_draft_denies_other_shop_and_buyer_and_retention_invalidates(client, monkeypatch):
    from datetime import datetime

    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    from app.services.structured_retention import calendar_deadline, purge_completed_orders
    order, receipt = await exception_case(client)
    confirmed = await decision(client, order, receipt)
    path = f"/api/seller/orders/{order['id']}/courier-draft"
    assert (await client.get(path)).status_code == 200
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('other-shop')
    await client.post('/api/seller/shop', json={'display_name': 'Other'})
    assert (await client.get(path)).status_code == 404
    app.dependency_overrides.pop(get_seller_identity)
    assert (await client.get(path)).status_code == 401
    assert (await client.get(f"/api/public/orders/{order['portal_token']}/courier-draft")).status_code == 404
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('seller_public_test_1')
    deadline = calendar_deadline(datetime.fromisoformat(confirmed.json()['completed_at']))
    assert (await purge_completed_orders(None, deadline, order['shop_id'])).removed == 1
    removed = await client.get(path)
    assert removed.status_code == 410
    assert 'Synthetic Buyer' not in removed.text


@pytest.mark.usefixtures('seller_identity')
async def test_local_preparation_failure_does_not_confirm_or_consume_receipt(client, monkeypatch):
    order, receipt = await exception_case(client)
    def fail(*args):
        raise RuntimeError('synthetic draft failure')
    with monkeypatch.context() as patch:
        patch.setattr('app.services.courier_drafts.prepare_memory_draft', fail)
        with pytest.raises(RuntimeError, match='synthetic draft failure'):
            await decision(client, order, receipt)
    assert (await client.get(f"/api/seller/orders/{order['id']}")).json() == order
    assert (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()['allocated_order_id'] is None
    assert (await client.get('/api/seller/payment-summary')).json()['confirmed_count'] == 0
    assert (await decision(client, order, receipt)).status_code == 200
    assert (await client.get(f"/api/seller/orders/{order['id']}/courier-draft")).status_code == 200


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('receipt_first', [True, False])
async def test_offline_automatic_draft_both_arrival_orders(client, receipt_first):
    from test_public_order_routes import _create_test_order
    order = await _create_test_order(client)
    async def receipt():
        return await client.post('/api/seller/transactions', json={
            'payment_account_id': order['payment_account_id'], 'provider': 'bkash',
            'trx_id': 'AUTO-DRAFT', 'amount_minor': 200000, 'sender_number': '01822222222',
            'occurred_at': order['created_at']}, headers={'Idempotency-Key': 'auto-receipt'})
    async def claim():
        return await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={
            'buyer_name': 'Courier Buyer', 'contact_number': '01711111111',
            'address': {'raw_text': 'Courier address'},
            'payment_claim': {'provider': 'bkash', 'trx_id': 'AUTO-DRAFT',
                              'sender_number': '01822222222', 'amount_minor': 200000}},
            headers={'Idempotency-Key': 'auto-claim'})
    first, second = (receipt, claim) if receipt_first else (claim, receipt)
    assert (await first()).status_code in (200, 201)
    assert (await second()).status_code in (200, 201)
    path = f"/api/seller/orders/{order['id']}/courier-draft"
    response = await client.get(path)
    assert response.status_code == 200, response.text
    assert response.json()['remaining_cod_minor'] == 1000000
    assert response.json()['contact_number'] == '01711111111'
    assert (await receipt()).status_code in (200, 201)
    assert (await claim()).status_code == 200
    assert (await client.get(path)).json() == response.json()


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_invalid_early_parcel_values_are_rejected_at_order_creation(client):
    base = await _create_test_order(client)
    before = (await client.get('/api/seller/orders')).json()['items']
    invalid = [
        {'parcel_weight_grams': 0}, {'parcel_weight_grams': True},
        {'parcel_weight_grams': 1.5}, {'parcel_weight_grams': 1000001},
        {'parcel_quantity': 0}, {'parcel_quantity': True},
        {'parcel_quantity': 1.5}, {'parcel_quantity': 10001},
    ]
    for index, parcel in enumerate(invalid):
        response = await client.post('/api/seller/orders', json={
            'product_name': 'Invalid parcel order', 'total_minor': 1200000,
            'required_advance_minor': 200000, 'payment_account_id': base['payment_account_id'],
            **parcel,
        }, headers={'Idempotency-Key': f'invalid-parcel-{index}'})
        assert response.status_code == 422, (parcel, response.text)
    after = (await client.get('/api/seller/orders')).json()['items']
    assert [item['id'] for item in after] == [item['id'] for item in before]


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_omitted_early_parcel_fields_block_only_parcel_completion(client):
    order = await parcel_order(client, 'parcel-omitted')
    assert order['parcel_weight_grams'] is None and order['parcel_quantity'] is None
    await confirm_automatically(client, order, 'PARCEL-OMITTED')
    path = f"/api/seller/orders/{order['id']}/courier-draft"
    draft = (await client.get(path)).json()
    assert draft['parcel_weight_grams'] is None and draft['parcel_quantity'] is None
    assert draft['missing_parcel_fields'] == ['weight', 'quantity']
    assert 'PARCEL_DETAILS_REQUIRED' in draft['blockers']
    assert draft['remaining_cod_minor'] == 1000000
    response = await client.patch(path, json={
        'expected_version': draft['version'], 'parcel_quantity': 2,
    }, headers={'Idempotency-Key': 'parcel-partial'})
    assert response.status_code == 200, response.text
    assert response.json()['parcel_weight_grams'] is None
    assert response.json()['parcel_quantity'] == 2
    assert response.json()['missing_parcel_fields'] == ['weight']
    assert 'PARCEL_DETAILS_REQUIRED' in response.json()['blockers']


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_early_parcel_values_are_shown_in_a_complete_draft(client):
    order = await parcel_order(client, 'parcel-early', parcel_weight_grams=1500, parcel_quantity=3)
    assert order['parcel_weight_grams'] == 1500 and order['parcel_quantity'] == 3
    await confirm_automatically(client, order, 'PARCEL-EARLY')
    response = await client.get(f"/api/seller/orders/{order['id']}/courier-draft")
    assert response.status_code == 200, response.text
    draft = response.json()
    assert draft['parcel_weight_grams'] == 1500 and draft['parcel_quantity'] == 3
    assert draft['missing_parcel_fields'] == []
    assert 'PARCEL_DETAILS_REQUIRED' not in draft['blockers']
    assert draft['remaining_cod_minor'] == 1000000


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_draft_edit_completes_fields_idempotently_without_changing_terms(client):
    order = await parcel_order(client, 'parcel-edit')
    await confirm_automatically(client, order, 'PARCEL-EDIT')
    path = f"/api/seller/orders/{order['id']}/courier-draft"
    draft = (await client.get(path)).json()
    payload = {'expected_version': draft['version'], 'parcel_weight_grams': 2500, 'parcel_quantity': 4}
    first = await client.patch(path, json=payload, headers={'Idempotency-Key': 'parcel-save'})
    assert first.status_code == 200, first.text
    saved = first.json()
    assert saved['parcel_weight_grams'] == 2500 and saved['parcel_quantity'] == 4
    assert saved['missing_parcel_fields'] == [] and saved['version'] == draft['version'] + 1
    assert saved['remaining_cod_minor'] == draft['remaining_cod_minor']
    assert saved['recipient_name'] == draft['recipient_name']
    assert (await client.patch(path, json=payload, headers={'Idempotency-Key': 'parcel-save'})).json() == saved
    conflict = await client.patch(path, json={**payload, 'parcel_quantity': 5},
                                  headers={'Idempotency-Key': 'parcel-save'})
    assert conflict.status_code == 409
    assert conflict.json()['error']['code'] == 'IDEMPOTENCY_KEY_REUSED'
    current_order = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert (current_order['total_minor'], current_order['required_advance_minor'],
            current_order['actual_cod_minor']) == (1200000, 200000, 1000000)


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_invalid_stale_and_foreign_draft_edits_never_overwrite(client):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app

    order = await parcel_order(client, 'parcel-invalid')
    await confirm_automatically(client, order, 'PARCEL-INVALID')
    path = f"/api/seller/orders/{order['id']}/courier-draft"
    draft = (await client.get(path)).json()
    for change in ({'parcel_weight_grams': 0}, {'parcel_weight_grams': True},
                   {'parcel_weight_grams': 1000001}, {'parcel_weight_grams': None},
                   {'parcel_quantity': 1.5}, {'parcel_quantity': 10001},
                   {'parcel_quantity': None}, {}):
        response = await client.patch(path, json={'expected_version': draft['version'], **change},
                                      headers={'Idempotency-Key': 'parcel-invalid'})
        assert response.status_code == 422, (change, response.text)
    assert (await client.get(path)).json() == draft
    saved = await client.patch(path, json={
        'expected_version': draft['version'], 'parcel_weight_grams': 800, 'parcel_quantity': 1,
    }, headers={'Idempotency-Key': 'parcel-valid'})
    assert saved.status_code == 200, saved.text
    current = saved.json()
    stale = await client.patch(path, json={
        'expected_version': draft['version'], 'parcel_weight_grams': 900, 'parcel_quantity': 2,
    }, headers={'Idempotency-Key': 'parcel-stale'})
    assert stale.status_code == 409 and stale.json()['error']['code'] == 'STALE_VERSION'
    assert (await client.get(path)).json() == current
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('foreign-parcel-seller')
    await client.post('/api/seller/shop', json={'display_name': 'Foreign parcel'})
    assert (await client.patch(path, json={
        'expected_version': current['version'], 'parcel_weight_grams': 950, 'parcel_quantity': 3,
    }, headers={'Idempotency-Key': 'parcel-foreign'})).status_code == 404
    app.dependency_overrides.pop(get_seller_identity)
    assert (await client.patch(path, json={
        'expected_version': current['version'], 'parcel_weight_grams': 950, 'parcel_quantity': 3,
    }, headers={'Idempotency-Key': 'parcel-anonymous'})).status_code == 401


@pytest.mark.asyncio
@pytest.mark.usefixtures('seller_identity')
async def test_cancelled_order_rejects_edits_and_keeps_stored_parcel_details(client):
    order = await parcel_order(client, 'parcel-cancelled')
    await confirm_automatically(client, order, 'PARCEL-CANCELLED')
    path = f"/api/seller/orders/{order['id']}/courier-draft"
    draft = (await client.get(path)).json()
    saved = await client.patch(path, json={
        'expected_version': draft['version'], 'parcel_weight_grams': 1500, 'parcel_quantity': 2,
    }, headers={'Idempotency-Key': 'parcel-cancelled-save'})
    assert saved.status_code == 200, saved.text
    current = saved.json()
    confirmed_order = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    cancelled = await client.post(f"/api/seller/orders/{order['id']}/decisions", json={
        'action': 'cancel', 'expected_version': confirmed_order['version'], 'reason': 'Stop dispatch',
    }, headers={'Idempotency-Key': 'parcel-cancelled-stop'})
    assert cancelled.status_code == 200, cancelled.text
    rejected = await client.patch(path, json={
        'expected_version': current['version'], 'parcel_weight_grams': 900, 'parcel_quantity': 1,
    }, headers={'Idempotency-Key': 'parcel-cancelled-edit'})
    assert rejected.status_code == 409
    assert rejected.json()['error']['code'] == 'INVALID_LIFECYCLE'
    unchanged = (await client.get(path)).json()
    assert unchanged['parcel_weight_grams'] == 1500 and unchanged['parcel_quantity'] == 2
    assert 'ORDER_NOT_CONFIRMED' in unchanged['blockers']
