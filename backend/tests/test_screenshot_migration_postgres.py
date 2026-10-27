"""Reconstruct legacy image data, then test the forward removal migration."""
from pathlib import Path

import pytest
from buyer_postgres_support import PAYLOAD

pytestmark = pytest.mark.asyncio
MIGRATIONS = Path(__file__).parents[1] / 'migrations'


async def test_removal_preserves_manual_claims_and_unrelated_replays(postgres_buyer):
    client, connection, _, order = postgres_buyer
    submitted = await client.post(f"/api/public/orders/{order['portal_token']}/submission",
        json=PAYLOAD, headers={'Idempotency-Key': 'manual'})
    assert submitted.status_code == 200
    before = dict(await connection.fetchrow('SELECT * FROM buyer_revisions'))
    orders = [dict(r) for r in await connection.fetch('SELECT * FROM orders')]
    replays = [dict(r) for r in await connection.fetch('SELECT * FROM idempotency_records ORDER BY key')]
    await connection.execute((MIGRATIONS / '0012_order_evidence.sql').read_text())
    await connection.execute((MIGRATIONS / '0014_payment_extractions.sql').read_text())
    await connection.execute('ALTER TABLE buyer_revisions ADD COLUMN payment_evidence_id VARCHAR(64)')
    await connection.execute("""INSERT INTO order_evidence VALUES
        ('legacy-image', $1, $2, 'shop/order/image.png', 'image/png', 20, 10, 10,
        'hash', 'attached', now(), now() + interval '30 days', NULL)""", order['shop_id'], order['id'])
    await connection.execute("UPDATE buyer_revisions SET payment_evidence_id='legacy-image'")
    await connection.execute("""INSERT INTO payment_extractions VALUES
        ('legacy-extraction', $1, $2, 'extract', 'hash', 'complete',
        '{"suggestions":{"trx_id":"private"}}', 'legacy-image', 'private output',
        now(), now() + interval '30 days')""", order['shop_id'], order['id'])
    await connection.execute("""INSERT INTO idempotency_records
        (key, scope, operation, payload_hash, status_code, response_json)
        VALUES ('legacy-upload', 'scope', 'buyer_evidence_upload', 'hash', 201,
        '{"evidence_id":"legacy-image"}')""")
    migration = (MIGRATIONS / '0026_remove_payment_screenshots.sql').read_text()
    async with connection.transaction():
        await connection.execute(migration)
    # Restart/retry is safe and does not remove unrelated replay protections.
    await connection.execute(migration)
    assert await connection.fetchval("SELECT to_regclass('order_evidence')") is None
    assert await connection.fetchval("SELECT to_regclass('payment_extractions')") is None
    assert dict(await connection.fetchrow('SELECT * FROM buyer_revisions')) == before
    assert [dict(r) for r in await connection.fetch('SELECT * FROM orders')] == orders
    assert [dict(r) for r in await connection.fetch('SELECT * FROM idempotency_records ORDER BY key')] == replays
    assert (await client.get(f"/api/seller/orders/{order['id']}/history")).status_code == 200
