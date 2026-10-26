"""Seller-only local courier proposals through the HTTP boundary."""
import pytest
from test_payment_exceptions import exception_case
from test_payment_exceptions_postgres import decision
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401


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
