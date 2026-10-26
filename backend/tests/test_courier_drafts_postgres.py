"""Durable courier work is committed with confirmation, never with a browser event."""
import asyncio
from datetime import datetime

import asyncpg
import pytest
from buyer_postgres_support import wait_for_order_waiters
from test_durable_confirmation_postgres import test_postgres_manual_receipt_both_arrival_orders as arrival_case
from test_payment_exceptions import exception_case
from test_payment_exceptions_postgres import decision

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.services.order_service import reset_order_memory_store
from app.services.structured_retention import calendar_deadline


async def read_draft(client, order):
    response = await client.get(f"/api/seller/orders/{order['id']}/courier-draft")
    assert response.status_code == 200, response.text
    return response.json()


async def parcel_order(client, base, key, **parcel):
    response = await client.post('/api/seller/orders', json={
        'product_name': 'Parcel order', 'total_minor': 1200000, 'required_advance_minor': 200000,
        'payment_account_id': base['payment_account_id'], **parcel,
    }, headers={'Idempotency-Key': key})
    assert response.status_code == 201, response.text
    return response.json()


async def confirm_automatically(client, order, transaction_id):
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


@pytest.mark.parametrize('receipt_first', [True, False])
async def test_automatic_draft_both_arrival_orders_replay_restart(postgres_buyer, receipt_first):
    client, connection, _, order = postgres_buyer
    await arrival_case(postgres_buyer, receipt_first)
    draft = await read_draft(client, order)
    assert draft['contact_number'] == '01711111111'
    assert draft['address'] == 'Durable Road, Dhaka'
    assert draft['remaining_cod_minor'] == 1000000
    assert draft['status'] == 'local_proposal'
    assert len(draft['blockers']) == 3
    reset_order_memory_store()
    assert await read_draft(client, order) == draft
    assert await connection.fetchval('SELECT count(*) FROM courier_drafts WHERE order_id=$1', order['id']) == 1
    with pytest.raises(asyncpg.UniqueViolationError):
        await connection.execute('INSERT INTO courier_drafts(order_id, created_at) VALUES($1, now())', order['id'])


@pytest.mark.parametrize('amount,cod', [(150000, 1050000), (1200000, 0)])
async def test_manual_persistent_private_draft_and_retention(postgres_buyer, monkeypatch, amount, cod):
    client, connection, _, _ = postgres_buyer
    order, receipt = await exception_case(client, amount)
    result = await decision(client, order, receipt)
    assert result.status_code == 200, result.text
    draft = await read_draft(client, order)
    assert draft['remaining_cod_minor'] == cod
    assert draft['contact_number'] == '01711111111'
    reset_order_memory_store()
    assert await read_draft(client, order) == draft
    assert (await decision(client, order, receipt)).json() == result.json()
    assert await connection.fetchval('SELECT count(*) FROM courier_drafts') == 1
    corrected = await client.patch(f"/api/seller/orders/{order['id']}/buyer-details", json={
        'expected_version': result.json()['version'], 'reason': 'Updated delivery contact',
        'buyer_name': 'Updated Buyer', 'contact_number': '01933333333',
        'address': {'raw_text': 'Updated Dhaka address'}}, headers={'Idempotency-Key': 'courier-correction'})
    assert corrected.status_code == 200, corrected.text
    current = await read_draft(client, order)
    assert current['recipient_name'] == 'Updated Buyer'
    assert current['contact_number'] == '01933333333'
    assert current['address'] == 'Updated Dhaka address'
    assert current['remaining_cod_minor'] == cod
    assert current['created_at'] == draft['created_at']
    public = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert 'courier_draft' not in public and 'contact_number' not in public
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('foreign-seller')
    await client.post('/api/seller/shop', json={'display_name': 'Foreign'})
    path = f"/api/seller/orders/{order['id']}/courier-draft"
    assert (await client.get(path)).status_code == 404
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('synthetic-postgres')
    deadline = calendar_deadline(datetime.fromisoformat(result.json()['completed_at']))
    monkeypatch.setattr('app.api.structured_retention.get_utc_now', lambda: deadline)
    cleanup = await client.post('/api/seller/retention/structured/cleanup')
    assert cleanup.status_code == 200, cleanup.text
    assert cleanup.json()['removed'] == 1
    assert await connection.fetchval('SELECT count(*) FROM courier_drafts') == 0
    assert (await client.get(path)).status_code == 410


async def test_draft_insert_failure_rolls_back_confirmation_and_retry_is_safe(postgres_buyer):
    client, connection, _, _ = postgres_buyer
    order, receipt = await exception_case(client)
    await connection.execute("""CREATE FUNCTION fail_courier() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic courier failure'; END $$;
        CREATE TRIGGER fail_courier BEFORE INSERT ON courier_drafts
        FOR EACH ROW EXECUTE FUNCTION fail_courier();""")
    result = await decision(client, order, receipt)
    assert result.status_code == 503, result.text
    assert (await client.get(f"/api/seller/orders/{order['id']}")).json() == order
    assert (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()['allocated_order_id'] is None
    for table in ('courier_drafts', 'allocations', 'used_payment_markers'):
        assert await connection.fetchval(f'SELECT count(*) FROM {table}') == 0
    assert (await client.get('/api/seller/payment-summary')).json()['confirmed_count'] == 0
    await connection.execute('DROP TRIGGER fail_courier ON courier_drafts')
    assert (await decision(client, order, receipt)).status_code == 200
    assert (await read_draft(client, order))['remaining_cod_minor'] == 1050000


@pytest.mark.parametrize('same_key', [True, False])
async def test_concurrent_confirmation_creates_one_draft(postgres_buyer, same_key):
    client, connection, _, _ = postgres_buyer
    order, receipt = await exception_case(client)
    await connection.execute('BEGIN')
    await connection.execute('SELECT id FROM shops WHERE id=$1 FOR UPDATE', order['shop_id'])
    tasks = [asyncio.create_task(decision(client, order, receipt, key))
             for key in ('accept', 'accept' if same_key else 'rival')]
    try:
        await wait_for_order_waiters(connection, 2)
    finally:
        await connection.execute('COMMIT')
        results = await asyncio.gather(*tasks)
    assert sorted(r.status_code for r in results) == ([200, 200] if same_key else [200, 409])
    assert await connection.fetchval('SELECT count(*) FROM courier_drafts') == 1
    assert (await read_draft(client, order))['remaining_cod_minor'] == 1050000


async def test_automatic_draft_failure_rolls_back_submission(postgres_buyer):
    client, connection, _, order = postgres_buyer
    receipt = await client.post('/api/seller/transactions', json={
        'payment_account_id': order['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'AUTO-FAIL', 'amount_minor': 200000, 'sender_number': '01822222222',
        'occurred_at': order['created_at']}, headers={'Idempotency-Key': 'auto-fail-receipt'})
    assert receipt.status_code == 201, receipt.text
    await connection.execute("""CREATE FUNCTION fail_auto_courier() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic courier failure'; END $$;
        CREATE TRIGGER fail_auto_courier BEFORE INSERT ON courier_drafts
        FOR EACH ROW EXECUTE FUNCTION fail_auto_courier();""")
    payload = {'buyer_name': 'Synthetic', 'contact_number': '01711111111',
               'address': {'raw_text': 'Synthetic Dhaka'},
               'payment_claim': {'provider': 'bkash', 'trx_id': 'AUTO-FAIL',
                                 'sender_number': '01822222222', 'amount_minor': 200000}}
    path = f"/api/public/orders/{order['portal_token']}/submission"
    result = await client.post(path, json=payload, headers={'Idempotency-Key': 'auto-fail-claim'})
    assert result.status_code == 503, result.text
    assert (await client.get(f"/api/seller/orders/{order['id']}")).json()['lifecycle'] == 'awaiting_buyer'
    for table in ('courier_drafts', 'allocations', 'used_payment_markers', 'buyer_revisions'):
        assert await connection.fetchval(f'SELECT count(*) FROM {table}') == 0
    await connection.execute('DROP TRIGGER fail_auto_courier ON courier_drafts')
    retry = await client.post(path, json=payload, headers={'Idempotency-Key': 'auto-fail-claim'})
    assert retry.status_code == 200, retry.text
    assert retry.json()['lifecycle'] == 'confirmed'
    assert (await read_draft(client, order))['remaining_cod_minor'] == 1000000


async def test_early_parcel_values_survive_confirmation_restart_and_correction(postgres_buyer):
    client, connection, _, base = postgres_buyer
    order = await parcel_order(client, base, 'pg-early-parcel',
                               parcel_weight_grams=1500, parcel_quantity=3)
    await confirm_automatically(client, order, 'PG-EARLY')
    draft = await read_draft(client, order)
    assert draft['parcel_weight_grams'] == 1500 and draft['parcel_quantity'] == 3
    assert draft['missing_parcel_fields'] == []
    assert await connection.fetchrow(
        'SELECT parcel_weight_grams, parcel_quantity FROM courier_drafts WHERE order_id=$1',
        order['id']) == (1500, 3)
    reset_order_memory_store()
    assert await read_draft(client, order) == draft
    saved = await client.patch(f"/api/seller/orders/{order['id']}/courier-draft", json={
        'expected_version': draft['version'], 'parcel_weight_grams': 2600, 'parcel_quantity': 5,
    }, headers={'Idempotency-Key': 'pg-parcel-save'})
    assert saved.status_code == 200, saved.text
    assert saved.json()['parcel_weight_grams'] == 2600 and saved.json()['parcel_quantity'] == 5
    reset_order_memory_store()
    current = await read_draft(client, order)
    assert current['remaining_cod_minor'] == 1000000
    assert (current['recipient_name'], current['contact_number'], current['address']) == (
        'Parcel Buyer', '01711111111', 'Parcel address, Dhaka')
    assert await connection.fetchrow(
        'SELECT total_minor, required_advance_minor FROM orders WHERE id=$1',
        order['id']) == (1200000, 200000)
    assert await connection.fetchval(
        'SELECT accepted_amount_minor FROM allocations WHERE order_id=$1', order['id']) == 200000
    assert await connection.fetchval('SELECT count(*) FROM courier_drafts WHERE order_id=$1',
                                     order['id']) == 1


async def test_postgres_stale_and_foreign_parcel_edits_do_not_overwrite(postgres_buyer):
    client, connection, _, base = postgres_buyer
    order = await parcel_order(client, base, 'pg-parcel-stale')
    await confirm_automatically(client, order, 'PG-STALE')
    draft = await read_draft(client, order)
    first = await client.patch(f"/api/seller/orders/{order['id']}/courier-draft", json={
        'expected_version': draft['version'], 'parcel_weight_grams': 700, 'parcel_quantity': 2,
    }, headers={'Idempotency-Key': 'pg-stale-first'})
    assert first.status_code == 200, first.text
    stale = await client.patch(f"/api/seller/orders/{order['id']}/courier-draft", json={
        'expected_version': draft['version'], 'parcel_weight_grams': 900, 'parcel_quantity': 9,
    }, headers={'Idempotency-Key': 'pg-stale-second'})
    assert stale.status_code == 409 and stale.json()['error']['code'] == 'STALE_VERSION'
    assert await read_draft(client, order) == first.json()
    assert await connection.fetchrow(
        'SELECT parcel_weight_grams, parcel_quantity FROM courier_drafts WHERE order_id=$1',
        order['id']) == (700, 2)
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('pg-foreign-parcel')
    await client.post('/api/seller/shop', json={'display_name': 'PG Foreign'})
    foreign = await client.patch(f"/api/seller/orders/{order['id']}/courier-draft", json={
        'expected_version': first.json()['version'], 'parcel_weight_grams': 1000, 'parcel_quantity': 10,
    }, headers={'Idempotency-Key': 'pg-foreign-edit'})
    assert foreign.status_code == 404
    assert await connection.fetchrow(
        'SELECT parcel_weight_grams, parcel_quantity FROM courier_drafts WHERE order_id=$1',
        order['id']) == (700, 2)
