"""Explicit maintenance allowlists, verified through PostgreSQL and HTTP."""
import pytest
from test_structured_retention_postgres import confirm_case

from app.services.obsolete_cleanup import cleanup_obsolete_orders


async def test_early_cleanup_is_scoped_repeatable_and_keeps_payment_protection(postgres_buyer):
    client, connection, sessions, _ = postgres_buyer
    order, receipt = await confirm_case(client)
    unrelated = (await client.post('/api/seller/orders', json={
        'product_name': 'Preserved courier phase order', 'total_minor': 1000,
        'required_advance_minor': 100, 'payment_account_id': order['payment_account_id']},
        headers={'Idempotency-Key': 'unrelated-order'})).json()
    # Historical Phase 1 rows predate automatic courier-draft creation.
    await connection.execute('DELETE FROM courier_drafts WHERE order_id=$1', order['id'])
    targets = {order['id']: order['shop_id']}
    async with sessions() as db:
        result = await cleanup_obsolete_orders(db, targets)
    assert result == {'removed': [order['id']], 'already_removed': [], 'failed': []}
    assert (await client.get(f"/api/public/orders/{order['portal_token']}")).status_code == 410
    assert (await client.get(f"/api/seller/orders/{unrelated['id']}")).status_code == 200
    assert await connection.fetchval('SELECT count(*) FROM shops') == 1
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1
    assert await connection.fetchval('SELECT count(*) FROM buyer_revisions WHERE order_id=$1', order['id']) == 0
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE response_json LIKE '%Synthetic Buyer%'") == 0
    async with sessions() as db:
        assert await cleanup_obsolete_orders(db, targets) == {
            'removed': [], 'already_removed': [order['id']], 'failed': []}
    replay = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'EXCEPTION', 'amount_minor': 150000}, headers={'Idempotency-Key': 'after-maintenance'})
    assert replay.status_code == 409
    assert replay.json()['error']['code'] == 'PAYMENT_USED'


async def test_unknown_target_or_memory_fails_closed(postgres_buyer):
    _, connection, sessions, order = postgres_buyer
    with pytest.raises(ValueError):
        await cleanup_obsolete_orders(None, {order['id']: order['shop_id']})
    async with sessions() as db:
        with pytest.raises(ValueError):
            await cleanup_obsolete_orders(db, {order['id']: 'wrong-shop'})
    assert await connection.fetchval('SELECT retained_at FROM orders WHERE id=$1', order['id']) is None


async def test_sms_copies_are_erased(postgres_buyer):
    client, connection, sessions, order = postgres_buyer
    imported = await client.post('/api/seller/transactions/sms-import', json={
        'payment_account_id': order['payment_account_id'],
        'messages': ['bKash: You have received Tk 2000.00 from 01822222222. TrxID OLDTEST001 at 2026-10-25T10:00:00+06:00']},
        headers={'Idempotency-Key': 'obsolete-sms'})
    assert imported.status_code == 200, imported.text
    # Parser-independent receipt claim uses the exact identity returned by import.
    receipt_id = imported.json()['items'][0]['receipt_id']
    assert receipt_id is not None, imported.text
    submitted = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={
        'buyer_name': 'Old Buyer', 'contact_number': '01711111111',
        'address': {'raw_text': 'Old address'}, 'payment_claim': {
            'provider': 'bkash', 'trx_id': 'OLDTEST001', 'sender_number': '01822222222',
            'amount_minor': 200000}}, headers={'Idempotency-Key': 'old-submission'})
    assert submitted.status_code == 200
    async with sessions() as db:
        result = await cleanup_obsolete_orders(db, {order['id']: order['shop_id']})
    assert result['failed'] == []
    assert await connection.fetchval('SELECT count(*) FROM sms_evidence') == 0
    assert await connection.fetchval('SELECT count(*) FROM transaction_observations') == 0
    assert await connection.fetchval('SELECT count(*) FROM received_transactions') == 0
    assert 'OLDTEST001' not in await connection.fetchval('SELECT result_json FROM sms_imports')


async def test_partial_failure_rolls_back_record_and_retry_succeeds(postgres_buyer):
    client, connection, sessions, order = postgres_buyer
    confirmed, _ = await confirm_case(client)
    await connection.execute('DELETE FROM courier_drafts WHERE order_id=$1', confirmed['id'])
    other = (await client.post('/api/seller/orders', json={
        'product_name': 'Another obsolete order', 'total_minor': 1000,
        'required_advance_minor': 100, 'payment_account_id': order['payment_account_id']},
        headers={'Idempotency-Key': 'second-obsolete'})).json()
    await connection.execute("""CREATE FUNCTION fail_obsolete() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Synthetic failure'; END; $$;
        CREATE TRIGGER block_obsolete BEFORE DELETE ON buyer_revisions
        FOR EACH ROW EXECUTE FUNCTION fail_obsolete();""")
    targets = {order['id']: order['shop_id'], other['id']: other['shop_id']}
    async with sessions() as db:
        result = await cleanup_obsolete_orders(db, targets)
    assert result['failed'] == [order['id']]
    assert result['removed'] == [other['id']]
    assert (await client.get(f"/api/seller/orders/{order['id']}")).status_code == 200
    await connection.execute('DROP TRIGGER block_obsolete ON buyer_revisions; DROP FUNCTION fail_obsolete()')
    async with sessions() as db:
        result = await cleanup_obsolete_orders(db, targets)
    assert result['removed'] == [order['id']]
    assert result['already_removed'] == [other['id']]


async def test_courier_order_is_refused(postgres_buyer):
    client, _, sessions, _ = postgres_buyer
    order, _ = await confirm_case(client)
    async with sessions() as db:
        result = await cleanup_obsolete_orders(db, {order['id']: order['shop_id']})
    assert result['failed'] == [order['id']]
    assert (await client.get(f"/api/seller/orders/{order['id']}")).status_code == 200


async def test_preserved_claim_prevents_shared_receipt_erasure(postgres_buyer):
    client, connection, sessions, _ = postgres_buyer
    order, _ = await confirm_case(client)
    await connection.execute('DELETE FROM courier_drafts WHERE order_id=$1', order['id'])
    other = (await client.post('/api/seller/orders', json={
        'product_name': 'Preserved claimant', 'total_minor': 1000000,
        'required_advance_minor': 200000, 'payment_account_id': order['payment_account_id']},
        headers={'Idempotency-Key': 'preserved-claimant'})).json()
    response = await client.post(f"/api/public/orders/{other['portal_token']}/submission", json={
        'buyer_name': 'Preserved Buyer', 'contact_number': '01711111111',
        'address': {'raw_text': 'Preserved address'}, 'payment_claim': {
            'provider': 'bkash', 'trx_id': 'EXCEPTION', 'sender_number': '01822222222',
            'amount_minor': 200000}}, headers={'Idempotency-Key': 'preserved-claim'})
    assert response.status_code == 200
    async with sessions() as db:
        result = await cleanup_obsolete_orders(db, {order['id']: order['shop_id']})
    assert result['failed'] == [order['id']]
    assert await connection.fetchval('SELECT count(*) FROM buyer_revisions') == 2


async def test_unavailable_database_never_falls_back(postgres_buyer):
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    _, _, _, order = postgres_buyer
    engine = create_async_engine('postgresql+asyncpg://postgres@127.0.0.1:1/postgres')
    try:
        async with async_sessionmaker(engine)() as db:
            with pytest.raises(OSError):
                await cleanup_obsolete_orders(db, {order['id']: order['shop_id']})
    finally:
        await engine.dispose()
