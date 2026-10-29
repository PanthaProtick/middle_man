"""Reconstruct historical address AI, then prove the forward retirement erases it."""
import datetime as dt
import json
from pathlib import Path

import pytest
from test_structured_retention_postgres import confirm_case

from app.services.raw_evidence_cleanup import purge_raw_evidence

pytestmark = pytest.mark.asyncio
MIGRATIONS = Path(__file__).parents[1] / 'migrations'

LEGACY_ROW = """
INSERT INTO address_extractions
    (id, shop_id, order_id, mutation_key, payload_hash, result_json,
     raw_request, raw_response, collected_at, delete_after)
VALUES ($1, $2, $3, $4, 'legacy-hash', $5, $6, $7, $8, $9)
"""


async def _recreate_legacy_store(connection, shop_id, order_id):
    await connection.execute((MIGRATIONS / '0013_address_extractions.sql').read_text())
    collected = dt.datetime(2026, 10, 1, tzinfo=dt.timezone.utc)
    deadline = collected + dt.timedelta(days=30)
    suggestions = json.dumps({
        'available': True,
        'suggestions': {'district': 'Dhaka', 'thana': 'Dhanmondi', 'needs_clarification': False},
        'message': 'Review and edit suggestions before using them.',
    })
    await connection.execute(LEGACY_ROW, 'legacy-raw', shop_id, order_id, 'extract-raw',
                             suggestions, 'Private buyer address text', '{"district":"Dhaka"}',
                             collected, deadline)
    # An already raw-purged extraction still retains its structured replay/suggestions.
    await connection.execute(LEGACY_ROW, 'legacy-purged', shop_id, order_id, 'extract-purged',
                             suggestions, None, None, collected, deadline)


async def _seed_legacy_replays(connection):
    await connection.execute("""
        INSERT INTO idempotency_records
            (key, scope, operation, payload_hash, status_code, response_json, created_at)
        VALUES ('legacy-extract-key', 'legacy-scope', 'address_extraction', 'legacy-hash',
                200, '{"available": true, "suggestions": {"district": "Dhaka"}}', $1)
    """, dt.datetime(2026, 10, 1, tzinfo=dt.timezone.utc))
    await connection.execute("""
        UPDATE idempotency_records
        SET response_json = (response_json::jsonb || '{"ai_assistance_available": true}'::jsonb)::text
        WHERE operation = 'buyer_submission'
    """)


async def test_retirement_erases_ai_copies_and_preserves_confirmed_records(postgres_buyer):
    client, connection, sessions, setup_order = postgres_buyer
    confirmed, receipt = await confirm_case(client)
    order_id = confirmed['id']
    shop_id = await connection.fetchval('SELECT shop_id FROM orders WHERE id = $1', order_id)

    snapshots = {
        'revisions': [dict(row) for row in await connection.fetch(
            'SELECT * FROM buyer_revisions ORDER BY revision_number')],
        'orders': [dict(row) for row in await connection.fetch('SELECT * FROM orders ORDER BY id')],
        'receipts': [dict(row) for row in await connection.fetch(
            'SELECT * FROM received_transactions ORDER BY id')],
        'allocations': [dict(row) for row in await connection.fetch(
            'SELECT * FROM allocations ORDER BY id')],
        'markers': [dict(row) for row in await connection.fetch(
            'SELECT * FROM used_payment_markers ORDER BY id')],
    }
    cached_before = json.loads(await connection.fetchval(
        "SELECT response_json FROM idempotency_records WHERE operation = 'buyer_submission'"))
    # Submission replay keeps the original pending body; confirmation lives on the order row.
    assert cached_before['lifecycle'] == 'pending'
    assert await connection.fetchval('SELECT lifecycle FROM orders WHERE id = $1', order_id) == 'confirmed'

    await _recreate_legacy_store(connection, shop_id, order_id)
    await _seed_legacy_replays(connection)
    assert await connection.fetchval('SELECT count(*) FROM address_extractions') == 2

    migration = (MIGRATIONS / '0027_retire_address_ai.sql').read_text()
    await connection.execute(migration)
    await connection.execute(migration)

    assert await connection.fetchval("SELECT to_regclass('address_extractions')") is None
    assert await connection.fetchval(
        "SELECT count(*) FROM idempotency_records WHERE operation = 'address_extraction'") == 0
    cached_after = json.loads(await connection.fetchval(
        "SELECT response_json FROM idempotency_records WHERE operation = 'buyer_submission'"))
    assert 'ai_assistance_available' not in cached_after
    assert {key: value for key, value in cached_after.items()} == {
        key: value for key, value in cached_before.items() if key != 'ai_assistance_available'}

    assert [dict(row) for row in await connection.fetch(
        'SELECT * FROM buyer_revisions ORDER BY revision_number')] == snapshots['revisions']
    assert [dict(row) for row in await connection.fetch('SELECT * FROM orders ORDER BY id')] == snapshots['orders']
    assert [dict(row) for row in await connection.fetch(
        'SELECT * FROM received_transactions ORDER BY id')] == snapshots['receipts']
    assert [dict(row) for row in await connection.fetch(
        'SELECT * FROM allocations ORDER BY id')] == snapshots['allocations']
    assert [dict(row) for row in await connection.fetch(
        'SELECT * FROM used_payment_markers ORDER BY id')] == snapshots['markers']

    # Duplicate-payment protection survives: the used payment stays unusable for a new order.
    second = (await client.post('/api/seller/orders', json={
        'product_name': 'Second Order', 'total_minor': 1000000,
        'required_advance_minor': 300000,
        'payment_account_id': setup_order['payment_account_id'],
    }, headers={'Idempotency-Key': 'retire-second-order'})).json()
    claimed = await client.post(f"/api/public/orders/{second['portal_token']}/submission", json={
        'buyer_name': 'Rival Buyer', 'contact_number': '01722229992',
        'address': {'raw_text': 'Synthetic Chittagong address'},
        'payment_claim': {'provider': 'bkash', 'trx_id': receipt['trx_id'],
                          'sender_number': '01811119991', 'amount_minor': 150000},
    }, headers={'Idempotency-Key': 'retire-second-claim'})
    assert claimed.status_code == 200, claimed.text
    preview = await client.get(f"/api/seller/orders/{second['id']}/payment-preview",
                               params={'transaction_id': receipt['id']})
    assert preview.status_code == 200, preview.text
    assert 'PAYMENT_USED' in preview.json()['blockers']

    now = dt.datetime.now(dt.timezone.utc)
    for _ in range(2):
        async with sessions() as db:
            cleanup = await purge_raw_evidence(db, now, shop_id)
        assert cleanup.status == 'clean'
        assert cleanup.items_purged == 0
        assert cleanup.overdue_remaining == 0
    status = await client.get('/api/seller/retention/status')
    assert status.status_code == 200, status.text
    assert set(status.json()['counts']) == {'sms_active', 'sms_purged'}
