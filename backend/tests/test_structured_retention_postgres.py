"""Disposable PostgreSQL acceptance through cleanup and HTTP interfaces."""
import datetime as dt

from sqlalchemy import text
from test_payment_exceptions import exception_case

from app.services.structured_retention import purge_completed_orders, retention_status


async def confirm_case(client):
    order, receipt = await exception_case(client)
    result = await client.post(f"/api/seller/orders/{order['id']}/decisions", json={
        'action': 'confirm', 'expected_version': order['version'],
        'expected_transaction_version': receipt['version'], 'transaction_id': receipt['id'],
        'accepted_amount_minor': receipt['amount_minor'], 'reason': 'Synthetic acceptance'},
        headers={'Idempotency-Key': 'retention-confirm'})
    assert result.status_code == 200, result.text
    return result.json(), receipt


async def test_postgres_removal_keeps_consumed_payment_unspendable_after_restart(postgres_buyer):
    client, connection, sessions, _ = postgres_buyer
    order, receipt = await confirm_case(client)
    completion = dt.datetime.fromisoformat(order['completed_at'])
    deadline = completion.replace(year=completion.year + 1) + dt.timedelta(days=1)
    async with sessions() as db:
        assert (await purge_completed_orders(db, deadline, order['shop_id'])).removed == 1
    async with sessions() as restarted:
        assert (await retention_status(restarted, deadline, order['shop_id'])).overdue == 0
        assert (await purge_completed_orders(restarted, deadline, order['shop_id'])).removed == 0
    response = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert response.status_code == 410, response.text
    assert (await client.get(f"/api/seller/orders/{order['id']}/history")).status_code == 410
    inbox = await client.get('/api/seller/transactions')
    assert inbox.status_code == 200, inbox.text
    assert inbox.json()['items'] == []
    assert (await client.get(f"/api/seller/transactions/{receipt['id']}")).status_code == 410
    exported = await client.get('/api/seller/orders/export')
    assert exported.status_code == 200, exported.text
    assert 'EXCEPTION' not in exported.text
    assert (await client.get(f"/api/seller/orders/{order['id']}/summary")).status_code == 410
    replay = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'EXCEPTION', 'amount_minor': 150000}, headers={'Idempotency-Key': 'new-import'})
    assert replay.status_code == 409, replay.text
    assert replay.json()['error']['code'] == 'PAYMENT_USED'
    replay_original = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'EXCEPTION', 'amount_minor': 150000}, headers={'Idempotency-Key': 'exception-receipt'})
    assert replay_original.status_code == 410, replay_original.text
    imported = await client.post('/api/seller/transactions/sms-import', json={
        'payment_account_id': receipt['payment_account_id'], 'messages': [
        'bKash: You have received Tk 1500.00 from 01799999999. TrxID EXCEPTION at 2026-01-01T12:00:00+06:00']},
        headers={'Idempotency-Key': 'sms-replay'})
    assert imported.status_code == 409, imported.text
    # Privacy checks against persisted storage are intentional deletion acceptance.
    assert await connection.fetchval('SELECT count(*) FROM buyer_revisions') == 0
    assert await connection.fetchval('SELECT count(*) FROM transaction_observations') == 0
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1
    assert await connection.fetchval('SELECT count(*) FROM allocations') == 1
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE response_json LIKE '%Synthetic%'") == 0


async def test_key_rotation_fails_closed_and_cleanup_failure_survives_restart(postgres_buyer, monkeypatch):
    from app.core.config import settings
    client, _, sessions, _ = postgres_buyer
    order, receipt = await confirm_case(client)
    deadline = dt.datetime.fromisoformat(order['completed_at']) + dt.timedelta(days=367)

    # 1. Mismatched marker secret fails closed on cleanup and import
    monkeypatch.setattr(settings, 'PAYMENT_MARKER_SECRET', 'rotated-secret')
    monkeypatch.setattr(settings, 'PAYMENT_IDENTITY_SECRET', '')
    async with sessions() as db:
        result = await purge_completed_orders(db, deadline, order['shop_id'])
        assert result.failed >= 1
    async with sessions() as restarted:
        assert (await retention_status(restarted, deadline, order['shop_id'])).failed >= 1
    replay = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'new-identity', 'amount_minor': 150000}, headers={'Idempotency-Key': 'rotated'})
    assert replay.status_code == 503, replay.text
    assert replay.json()['error']['code'] == 'PAYMENT_MARKER_KEY_UNAVAILABLE'

    # 2. Restoring valid marker secret allows cleanup to complete
    monkeypatch.setattr(settings, 'PAYMENT_MARKER_SECRET', '')
    async with sessions() as db:
        assert (await purge_completed_orders(db, deadline, order['shop_id'])).failed == 0

    # 3. Rotating Clerk credentials does NOT invalidate consumed payment marker protection
    monkeypatch.setattr(settings, 'CLERK_SECRET_KEY', 'rotated-clerk-secret-after-cleanup')
    replay_clerk = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'EXCEPTION', 'amount_minor': 150000}, headers={'Idempotency-Key': 'clerk-rotated-replay'})
    assert replay_clerk.status_code == 409, replay_clerk.text
    assert replay_clerk.json()['error']['code'] == 'PAYMENT_USED'


async def test_unresolved_claim_preserves_shared_receipt_then_deletes_when_eligible(postgres_buyer):
    client, connection, sessions, _ = postgres_buyer
    order, receipt = await exception_case(client)
    pending = (await client.post('/api/seller/orders', json={
        'product_name': 'Second order', 'total_minor': 1200000, 'required_advance_minor': 200000,
        'payment_account_id': order['payment_account_id']}, headers={'Idempotency-Key': 'second-order'})).json()
    claim = {'buyer_name': 'Unresolved Buyer', 'contact_number': '01711111111',
        'address': {'raw_text': 'Unresolved address'}, 'payment_claim': {'provider': 'bkash',
        'trx_id': 'EXCEPTION', 'sender_number': '01822222222', 'amount_minor': 200000}}
    assert (await client.post(f"/api/public/orders/{pending['portal_token']}/submission", json=claim,
        headers={'Idempotency-Key': 'unresolved'})).status_code == 200
    stopped = await client.post(f"/api/seller/orders/{order['id']}/decisions", json={
        'action': 'reject', 'expected_version': order['version'], 'reason': 'Synthetic rejection'},
        headers={'Idempotency-Key': 'reject'})
    assert stopped.status_code == 200, stopped.text
    deadline = dt.datetime.fromisoformat(stopped.json()['completed_at']) + dt.timedelta(days=367)
    async with sessions() as db:
        await purge_completed_orders(db, deadline, order['shop_id'])
    assert (await client.get(f"/api/public/orders/{pending['portal_token']}")).json()['lifecycle'] == 'pending'
    assert await connection.fetchval('SELECT trx_id FROM received_transactions WHERE id=$1', receipt['id']) == 'EXCEPTION'
    assert (await client.get(f"/api/seller/transactions/{receipt['id']}")).status_code == 200
    # The second completion is later: its own calendar clock controls eventual removal.
    async with sessions() as db:
        await db.execute(text("UPDATE orders SET lifecycle='rejected', completed_at=:now WHERE id=:id"),
            {'now': deadline, 'id': pending['id']})
        await db.commit()
        await purge_completed_orders(db, deadline + dt.timedelta(days=367), order['shop_id'])
    assert await connection.fetchval('SELECT count(*) FROM received_transactions WHERE id=$1', receipt['id']) == 0


async def test_first_confirmation_clock_survives_cancellation_and_cleanup_contention(postgres_buyer):
    import asyncio
    client, connection, sessions, _ = postgres_buyer
    order, receipt = await confirm_case(client)
    first = dt.datetime(2024, 2, 29, 13, tzinfo=dt.timezone.utc)
    await connection.execute('UPDATE orders SET completed_at=$1 WHERE id=$2', first, order['id'])
    stopped = await client.post(f"/api/seller/orders/{order['id']}/decisions", json={
        'action': 'cancel', 'expected_version': order['version'], 'reason': 'Synthetic stop after acceptance'},
        headers={'Idempotency-Key': 'stop-confirmed'})
    assert dt.datetime.fromisoformat(stopped.json()['completed_at']) == first
    deadline = dt.datetime(2025, 2, 28, 13, tzinfo=dt.timezone.utc)
    async def cleanup():
        async with sessions() as db:
            return await purge_completed_orders(db, deadline, order['shop_id'])
    results = await asyncio.gather(cleanup(), cleanup())
    assert sum(r.removed for r in results) == 1
    assert await connection.fetchval('SELECT lifecycle FROM orders WHERE id=$1', order['id']) == 'cancelled'
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1
    # Direct manual approval using the retained allocation never becomes spendable.
    new = (await client.post('/api/seller/orders', json={'product_name': 'Next order',
        'total_minor': 1200000, 'required_advance_minor': 200000,
        'payment_account_id': order['payment_account_id']})).json()
    preview = await client.get(f"/api/seller/orders/{new['id']}/payment-preview", params={'transaction_id': receipt['id']})
    assert preview.status_code == 410, preview.text


async def test_sql_cleanup_failure_is_durable_and_retry_removes_personal_data(postgres_buyer):
    client, connection, sessions, _ = postgres_buyer
    order, _ = await confirm_case(client)
    deadline = dt.datetime.fromisoformat(order['completed_at']) + dt.timedelta(days=367)
    await connection.execute("""CREATE FUNCTION fail_retention() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic failure with private text'; END $$;
        CREATE TRIGGER block_retention BEFORE DELETE ON buyer_revisions FOR EACH ROW EXECUTE FUNCTION fail_retention();""")
    async with sessions() as db:
        status = await purge_completed_orders(db, deadline, order['shop_id'])
        assert status.failed == status.overdue == 1
        assert status.removed == 0
    async with sessions() as restarted:
        assert (await retention_status(restarted, deadline, order['shop_id'])).failed == 1
    assert await connection.fetchval('SELECT retention_error FROM orders WHERE id=$1', order['id']) == 'STRUCTURED_CLEANUP_FAILED'
    assert (await client.get(f"/api/seller/orders/{order['id']}/history")).json()['items']
    await connection.execute('DROP TRIGGER block_retention ON buyer_revisions; DROP FUNCTION fail_retention()')
    async with sessions() as db:
        status = await purge_completed_orders(db, deadline, order['shop_id'])
        assert status.removed == 1
        assert status.failed == status.overdue == 0


async def test_missing_marker_key_blocks_import_preview_and_cleanup(postgres_buyer, monkeypatch):
    from app.core.config import settings
    client, connection, sessions, _ = postgres_buyer
    order, receipt = await confirm_case(client)
    monkeypatch.setattr(settings, 'DATABASE_URL', 'postgresql://postgres@127.0.0.1:55447/postgres')
    monkeypatch.setattr(settings, 'PAYMENT_MARKER_SECRET', '')
    monkeypatch.setattr(settings, 'PAYMENT_IDENTITY_SECRET', '')
    monkeypatch.setattr(settings, 'CLERK_SECRET_KEY', 'sk_live_valid_clerk_key')
    imported = await client.post('/api/seller/transactions', json={'payment_account_id': receipt['payment_account_id'],
        'provider': 'bkash', 'trx_id': 'FRESH', 'amount_minor': 100})
    assert imported.status_code == 503, imported.text
    preview = await client.get(f"/api/seller/orders/{order['id']}/payment-preview", params={'transaction_id': receipt['id']})
    assert preview.status_code == 503, preview.text
    deadline = dt.datetime.fromisoformat(order['completed_at']) + dt.timedelta(days=367)
    async with sessions() as db:
        result = await purge_completed_orders(db, deadline, order['shop_id'])
        assert result.failed == result.overdue == 1
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1
    assert await connection.fetchval('SELECT count(*) FROM buyer_revisions') == 1


async def test_retention_views_and_cleanup_do_not_cross_shop_boundaries(postgres_buyer):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    client, connection, _, order = postgres_buyer
    await connection.execute("UPDATE orders SET lifecycle='cancelled', completed_at='2024-01-01T00:00:00Z' WHERE id=$1", order['id'])
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='another-synthetic-seller')
    assert (await client.get('/api/seller/retention/structured')).status_code == 404
    assert (await client.post('/api/seller/shop', json={'display_name': 'Other shop'})).status_code == 201
    status = await client.get('/api/seller/retention/structured')
    assert status.status_code == 200 and status.json()['overdue'] == 0
    assert (await client.post('/api/seller/retention/structured/cleanup')).json()['removed'] == 0
    assert (await client.get(f"/api/seller/orders/{order['id']}")).status_code == 404
    assert await connection.fetchval('SELECT retained_at FROM orders WHERE id=$1', order['id']) is None
