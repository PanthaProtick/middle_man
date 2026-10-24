"""Correction transactions on independently connected migrated PostgreSQL schemas."""
import asyncio

import pytest
from buyer_postgres_support import wait_for_order_waiters
from test_resolution import conflict_case


async def test_correction_rollback_replay_and_restart(postgres_buyer):
    client, connection, _, _ = postgres_buyer
    order, receipt = await conflict_case(client)
    path = f"/api/seller/transactions/{receipt['id']}"
    before = (await client.get(path)).json()
    payload = {'expected_version': receipt['version'], 'reason': 'App checked', 'amount_minor': 200000}
    await connection.execute("""
        CREATE FUNCTION reject_correction() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic outage'; END $$;
        CREATE TRIGGER reject_correction BEFORE INSERT ON idempotency_records
        FOR EACH ROW WHEN (NEW.operation='correct_receipt') EXECUTE FUNCTION reject_correction();
    """)
    failed = await client.patch(path, json=payload, headers={'Idempotency-Key': 'rollback'})
    assert failed.status_code == 503
    assert (await client.get(path)).json() == before
    assert await connection.fetchval('SELECT count(*) FROM allocations') == 0
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 0
    await connection.execute('DROP TRIGGER reject_correction ON idempotency_records')
    result = await client.patch(path, json=payload, headers={'Idempotency-Key': 'rollback'})
    assert result.status_code == 200, result.text
    assert result.json()['allocated_order_id'] == order['id']
    from app.services.transaction_store import reset_transaction_memory_store
    reset_transaction_memory_store()
    assert (await client.get(path)).json() == result.json()
    assert (await client.patch(path, json=payload, headers={'Idempotency-Key': 'rollback'})).json() == result.json()
    assert await connection.fetchval('SELECT count(*) FROM allocations') == 1
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1


@pytest.mark.parametrize('rival', ['correction', 'same-key', 'resolution', 'allocation'])
async def test_correction_serializes_against_other_writers(postgres_buyer, rival):
    client, connection, _, _ = postgres_buyer
    order, receipt = await conflict_case(client)
    path = f"/api/seller/transactions/{receipt['id']}"
    payload = {'expected_version': receipt['version'], 'reason': 'Correct amount', 'amount_minor': 200000}
    async def correct(key='correct'):
        return await client.patch(path, json=payload, headers={'Idempotency-Key': key})
    if rival in ('correction', 'same-key'):
        async def other():
            return await correct('correct' if rival == 'same-key' else 'other')
    elif rival == 'resolution':
        async def other():
            return await client.post(path + '/resolve', json={'expected_version': receipt['version'],
                'reason': 'Resolve original evidence', 'selected_observation_id': receipt['observations'][0]['id']},
                headers={'Idempotency-Key': 'resolve'})
    else:
        # A seller claim correction invokes the allocator through its public endpoint.
        async def other():
            return await client.patch(f"/api/seller/orders/{order['id']}/buyer-details", json={
                'expected_version': 2, 'reason': 'Buyer changed sender',
                'payment_claim': {'provider': 'bkash', 'trx_id': 'RESOLVE', 'sender_number': '01933333333', 'amount_minor': 200000}},
                headers={'Idempotency-Key': 'claim-correction'})
    await connection.execute('BEGIN')
    await connection.execute('SELECT id FROM shops WHERE id=$1 FOR UPDATE', order['shop_id'])
    tasks = [asyncio.create_task(correct()), asyncio.create_task(other())]
    try:
        await wait_for_order_waiters(connection, 2)
    finally:
        await connection.execute('COMMIT')
        responses = await asyncio.gather(*tasks)
    statuses = sorted(r.status_code for r in responses)
    assert statuses in ([200, 200], [200, 409]), [r.text for r in responses]
    if rival == 'same-key':
        assert responses[0].json() == responses[1].json()
    final = (await client.get(path)).json()
    allocations = await connection.fetchval('SELECT count(*) FROM allocations')
    assert allocations <= 1
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == allocations
    if allocations:
        assert final['receipt']['amount_minor'] == 200000
        assert final['receipt']['reconciliation_state'] == 'used'
        assert final['allocated_order_id'] == order['id']


async def test_identity_correction_rechecks_old_and_new_claims(postgres_buyer):
    client, _, _, _ = postgres_buyer
    order, receipt = await conflict_case(client)
    target = (await client.post('/api/seller/orders', json={'product_name': 'Correct identity order',
        'total_minor': 1200000, 'required_advance_minor': 200000, 'payment_account_id': order['payment_account_id']},
        headers={'Idempotency-Key': 'target'})).json()
    await client.post(f"/api/public/orders/{target['portal_token']}/submission", json={
        'buyer_name': 'Target buyer', 'contact_number': '01711111111', 'address': {'raw_text': 'Synthetic Dhaka'},
        'payment_claim': {'provider': 'bkash', 'trx_id': 'CORRECTED', 'sender_number': '01822222222', 'amount_minor': 200000}},
        headers={'Idempotency-Key': 'target-claim'})
    path = f"/api/seller/transactions/{receipt['id']}"
    result = await client.patch(path, json={'expected_version': receipt['version'], 'reason': 'Fix TrxID',
        'trx_id': 'CORRECTED', 'occurred_at': target['created_at']}, headers={'Idempotency-Key': 'identity'})
    assert result.status_code == 200, result.text
    assert result.json()['allocated_order_id'] == target['id']
    old = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert old['lifecycle'] == 'pending'
    assert old['review_reasons'] == []
    assert (await client.get(path)).json() == result.json()
