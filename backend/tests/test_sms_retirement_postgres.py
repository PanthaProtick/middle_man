"""Fresh migrated databases preserve historical receipts and cleanup after retirement."""
import datetime as dt

from legacy_sms_support import historical_sms_rows
from test_structured_retention_postgres import confirm_case

from app.services.raw_evidence_cleanup import purge_raw_evidence
from app.services.structured_retention import purge_completed_orders


async def test_historical_sms_receipt_allocation_survive_retirement_and_cleanup(postgres_buyer):
    client, connection, sessions, _ = postgres_buyer
    order, receipt = await confirm_case(client)
    # Represent a pre-retirement observation on the unchanged database schema.
    await connection.execute("UPDATE transaction_observations SET source='sms' WHERE transaction_id=$1", receipt['id'])
    async with sessions() as db:
        evidence, imported = historical_sms_rows(order['shop_id'], 'synthetic-postgres',
            order['payment_account_id'], receipt['id'])
        db.add_all([evidence, imported])
        await db.commit()
    original = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
    assert original['receipt']['observations'][0]['source'] == 'sms'
    allocation = dict(await connection.fetchrow('SELECT * FROM allocations WHERE transaction_id=$1', receipt['id']))
    assert (await client.get('/api/seller/transactions/sms-imports')).status_code == 404
    assert (await client.post('/api/seller/transactions/sms-import', json={})).status_code == 404
    async with sessions() as db:
        assert (await purge_raw_evidence(db, evidence.delete_after - dt.timedelta(seconds=1), order['shop_id'])).items_purged == 0
        assert (await purge_raw_evidence(db, evidence.delete_after, order['shop_id'])).items_purged == 1
        assert (await purge_raw_evidence(db, evidence.delete_after, order['shop_id'])).items_purged == 0
    assert (await client.get(f"/api/seller/transactions/{receipt['id']}")).json() == original
    assert dict(await connection.fetchrow('SELECT * FROM allocations WHERE transaction_id=$1', receipt['id'])) == allocation
    current = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert current['lifecycle'] == 'confirmed'
    assert current['actual_cod_minor'] == order['actual_cod_minor']
    assert await connection.fetchval('SELECT delete_after FROM sms_evidence WHERE id=$1', evidence.id) == evidence.delete_after
    deadline = dt.datetime.fromisoformat(order['completed_at']) + dt.timedelta(days=367)
    async with sessions() as db:
        assert (await purge_completed_orders(db, deadline, order['shop_id'])).removed == 1
    cached = await connection.fetchval('SELECT result_json FROM sms_imports WHERE id=$1', imported.id)
    assert 'record_unavailable' in cached
