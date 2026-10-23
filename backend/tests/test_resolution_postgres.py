"""Independent HTTP requests against isolated loopback PostgreSQL schemas."""
import asyncio

import pytest
from test_resolution import conflict_case


@pytest.mark.parametrize('same_key', [False, True])
async def test_concurrent_resolutions_commit_one_allocation(postgres_buyer, same_key):
    client, connection, _, _ = postgres_buyer
    order, receipt = await conflict_case(client, competing=True)
    path = f"/api/seller/transactions/{receipt['id']}"
    comparison = (await client.get(path)).json()
    choices = [order['id'], next(c['order_id'] for c in comparison['claims'] if c['order_id'] != order['id'])]
    decision = {'expected_version': receipt['version'], 'reason': 'Compared evidence and buyers',
                'selected_observation_id': receipt['observations'][0]['id']}
    await connection.execute('BEGIN')
    await connection.execute('SELECT id FROM shops WHERE id=$1 FOR UPDATE', order['shop_id'])
    tasks = [asyncio.create_task(client.post(path + '/resolve',
        json={**decision, 'selected_order_id': choices[0 if same_key else i]},
        headers={'Idempotency-Key': f'decision-{0 if same_key else i}'})) for i in range(2)]
    try:
        for _ in range(200):
            await connection.execute('SELECT pg_stat_clear_snapshot()')
            count = await connection.fetchval("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%shops%'")
            if count >= 2:
                break
            await asyncio.sleep(0.01)
        assert count >= 2
    finally:
        await connection.execute('COMMIT')
        results = await asyncio.gather(*tasks)
    assert sorted(r.status_code for r in results) == ([200, 200] if same_key else [200, 409]), [r.text for r in results]
    if same_key:
        assert results[0].json() == results[1].json()
    final = (await client.get(path)).json()
    assert sum(c['lifecycle'] == 'confirmed' for c in final['claims']) == 1
    assert sum(c['lifecycle'] == 'pending' and c['held_by_resolution'] for c in final['claims']) == 1
    assert await connection.fetchval('SELECT count(*) FROM allocations') == 1
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1
    assert await connection.fetchval("SELECT count(*) FROM audit_events WHERE action='evidence_resolved'") == 1


async def test_resolution_rollback_and_persisted_retry(postgres_buyer):
    client, connection, _, _ = postgres_buyer
    _, receipt = await conflict_case(client)
    path = f"/api/seller/transactions/{receipt['id']}"
    decision = {'expected_version': receipt['version'], 'reason': 'Checked received payment',
                'selected_observation_id': receipt['observations'][0]['id']}
    await connection.execute("""
        CREATE FUNCTION reject_decision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic outage'; END $$;
        CREATE TRIGGER reject_decision BEFORE INSERT ON idempotency_records
        FOR EACH ROW WHEN (NEW.operation='resolve_evidence') EXECUTE FUNCTION reject_decision();
    """)
    failed = await client.post(path + '/resolve', json=decision, headers={'Idempotency-Key': 'rollback'})
    assert failed.status_code == 503
    before = (await client.get(path)).json()
    assert before['receipt']['has_conflict']
    assert before['receipt']['version'] == receipt['version']
    assert before['history'] == []
    assert before['allocated_order_id'] is None
    await connection.execute('DROP TRIGGER reject_decision ON idempotency_records')
    result = await client.post(path + '/resolve', json=decision, headers={'Idempotency-Key': 'rollback'})
    assert result.status_code == 200, result.text
    from app.services.order_service import reset_order_memory_store
    reset_order_memory_store()
    assert (await client.get(path)).json() == result.json()
    retry = await client.post(path + '/resolve', json=decision, headers={'Idempotency-Key': 'rollback'})
    assert retry.json() == result.json()
    changed = await client.post(path + '/resolve', json={**decision, 'reason': 'Different'}, headers={'Idempotency-Key': 'rollback'})
    assert changed.status_code == 409

@pytest.mark.parametrize('arrival', ['claim', 'observation'])
async def test_resolution_contending_with_late_evidence_or_claim(postgres_buyer, arrival):
    client, connection, _, _ = postgres_buyer
    order, receipt = await conflict_case(client, competing=True)
    decision = {'expected_version': receipt['version'], 'reason': 'Compared current claims',
                'selected_observation_id': receipt['observations'][0]['id'], 'selected_order_id': order['id']}
    path = f"/api/seller/transactions/{receipt['id']}"
    if arrival == 'claim':
        third = (await client.post('/api/seller/orders', json={'product_name': 'Late claim order',
            'total_minor': 1200000, 'required_advance_minor': 200000, 'payment_account_id': order['payment_account_id']},
            headers={'Idempotency-Key': 'third'})).json()
        async def late():
            return await client.post(f"/api/public/orders/{third['portal_token']}/submission", json={
                'buyer_name': 'Late Buyer', 'contact_number': '01711111111', 'address': {'raw_text': 'Synthetic address'},
                'payment_claim': {'provider': 'bkash', 'trx_id': 'RESOLVE', 'amount_minor': 200000, 'sender_number': '01822222222'}},
                headers={'Idempotency-Key': 'late'})
    else:
        async def late():
            return await client.post('/api/seller/transactions', json={'payment_account_id': order['payment_account_id'],
                'provider': 'bkash', 'trx_id': 'RESOLVE', 'amount_minor': 199999, 'sender_number': '01822222222',
                'occurred_at': receipt['occurred_at']}, headers={'Idempotency-Key': 'late'})
    resolution, incoming = await asyncio.gather(
        client.post(path + '/resolve', json=decision, headers={'Idempotency-Key': 'racing'}), late())
    assert incoming.status_code == 200, incoming.text
    assert resolution.status_code in (200, 409), resolution.text
    final = (await client.get(path)).json()
    assert await connection.fetchval('SELECT count(*) FROM allocations') == (1 if resolution.status_code == 200 else 0)
    if resolution.status_code == 200:
        assert final['allocated_order_id'] == order['id']
        assert final['receipt']['reconciliation_state'] == 'used'
    else:
        assert all(c['lifecycle'] == 'pending' for c in final['claims'])
