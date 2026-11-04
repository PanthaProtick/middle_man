"""Scheduled retention against isolated PostgreSQL schemas, when configured."""
import asyncio
import datetime as dt

from test_structured_retention_postgres import confirm_case

from app.core import database
from app.core.config import settings
from app.services.scheduled_retention import run_scheduled_retention

NOW = dt.datetime(2026, 2, 28, 13, tzinfo=dt.timezone.utc)


async def seed_due(connection, shop_id):
    await connection.execute('''INSERT INTO sms_evidence
        (id, shop_id, owner_id, text_digest, raw_text, collected_at, delete_after)
        VALUES ('due', $1, 'synthetic', 'digest-due', 'private synthetic SMS', $2, $3),
        ('future', $1, 'synthetic', 'digest-future', 'not due',
         $2 + INTERVAL '1 microsecond', $4)''',
        shop_id, NOW - dt.timedelta(days=30), NOW, NOW + dt.timedelta(microseconds=1))


async def test_scheduler_boundary_overlap_repeat_and_payment_protection(postgres_buyer, monkeypatch):
    client, connection, sessions, _ = postgres_buyer
    order, receipt = await confirm_case(client)
    await connection.execute('UPDATE orders SET completed_at=$1 WHERE id=$2',
                             dt.datetime(2025, 2, 28, 13, tzinfo=dt.timezone.utc), order['id'])
    await seed_due(connection, order['shop_id'])
    await connection.execute('''INSERT INTO shops
        (id, owner_id, display_name, created_at, updated_at)
        VALUES ('other-shop', 'other-owner', 'Other synthetic shop', $1, $1)''', NOW)
    await connection.execute('''INSERT INTO sms_evidence
        (id, shop_id, owner_id, text_digest, raw_text, collected_at, delete_after)
        VALUES ('other-due', 'other-shop', 'other-owner', 'other-digest', 'due',
                $1::timestamptz - INTERVAL '30 days', $1)''', NOW)
    before = await run_scheduled_retention(sessions, NOW - dt.timedelta(microseconds=1))
    assert before.status == 'clean'
    assert (before.raw_purged, before.orders_removed) == (0, 0)
    results = await asyncio.gather(run_scheduled_retention(sessions, NOW),
                                   run_scheduled_retention(sessions, NOW))
    assert all(r.status == 'clean' for r in results)
    assert sum(r.raw_purged for r in results) == 2
    assert sum(r.orders_removed for r in results) == 1
    repeat = await run_scheduled_retention(sessions, NOW)
    assert (repeat.raw_purged, repeat.orders_removed) == (0, 0)
    assert await connection.fetchval("SELECT raw_text FROM sms_evidence WHERE id='future'") == 'not due'
    assert await connection.fetchval("SELECT text_digest FROM sms_evidence WHERE id='due'") == 'digest-due'
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1
    replay = await client.post('/api/seller/transactions', json={
        'payment_account_id': receipt['payment_account_id'], 'provider': 'bkash',
        'trx_id': 'EXCEPTION', 'amount_minor': 150000}, headers={'Idempotency-Key': 'scheduler-replay'})
    assert replay.status_code == 409
    monkeypatch.setattr(database, 'AsyncSessionLocal', sessions)
    monkeypatch.setattr(settings, 'CRON_SECRET', 'synthetic-scheduler-secret')
    response = await client.get('/api/maintenance/retention', headers={
        'Authorization': 'Bearer synthetic-scheduler-secret'})
    assert response.status_code == 200
    assert response.json()['status'] == 'clean'


async def test_scheduler_reports_failed_phase_and_retry_preserves_other_work(postgres_buyer, monkeypatch):
    client, connection, sessions, _ = postgres_buyer
    order, _ = await confirm_case(client)
    await connection.execute('UPDATE orders SET completed_at=$1 WHERE id=$2',
                             dt.datetime(2025, 2, 28, 13, tzinfo=dt.timezone.utc), order['id'])
    await seed_due(connection, order['shop_id'])
    await connection.execute('''CREATE FUNCTION fail_scheduler_raw() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'private driver message'; END $$;
        CREATE TRIGGER block_scheduler_raw BEFORE UPDATE ON sms_evidence
        FOR EACH ROW EXECUTE FUNCTION fail_scheduler_raw();''')
    partial = await run_scheduled_retention(sessions, NOW)
    assert partial.status == 'partial_failure'
    assert partial.phases_failed == 1
    assert partial.orders_removed == 1
    assert partial.raw_purged == 0
    assert 'private' not in partial.model_dump_json()
    monkeypatch.setattr(database, 'AsyncSessionLocal', sessions)
    monkeypatch.setattr(settings, 'CRON_SECRET', 'synthetic-scheduler-secret')
    response = await client.get('/api/maintenance/retention', headers={
        'Authorization': 'Bearer synthetic-scheduler-secret'})
    assert response.status_code == 503
    assert response.json()['status'] == 'partial_failure'
    await connection.execute('DROP TRIGGER block_scheduler_raw ON sms_evidence; DROP FUNCTION fail_scheduler_raw()')
    retry = await run_scheduled_retention(sessions, NOW)
    assert retry.status == 'clean'
    assert (retry.raw_purged, retry.orders_removed) == (1, 0)
