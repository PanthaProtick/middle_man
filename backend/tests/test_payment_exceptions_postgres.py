"""Real independent connections exercise the same HTTP decision boundary."""
import asyncio

import pytest
from buyer_postgres_support import wait_for_order_waiters
from test_payment_exceptions import exception_case


async def decision(client, order, receipt, key='accept'):
    return await client.post(f"/api/seller/orders/{order['id']}/decisions", json={
        'action':'confirm','expected_version':order['version'], 'expected_transaction_version':receipt['version'],
        'transaction_id':receipt['id'],'accepted_amount_minor':receipt['amount_minor'],'reason':'Accept app evidence'},
        headers={'Idempotency-Key':key})


async def test_manual_rollback_durability_and_replay(postgres_buyer):
    client, connection, _, _ = postgres_buyer
    order, receipt = await exception_case(client)
    await connection.execute("""
        CREATE FUNCTION reject_decision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic outage'; END $$;
        CREATE TRIGGER reject_decision BEFORE INSERT ON idempotency_records
        FOR EACH ROW WHEN (NEW.operation='accept_payment') EXECUTE FUNCTION reject_decision();
    """)
    failed = await decision(client,order,receipt)
    assert failed.status_code == 503, failed.text
    path = f"/api/seller/orders/{order['id']}"
    assert (await client.get(path)).json() == order
    comparison = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
    assert comparison['allocated_order_id'] is None
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 0
    assert (await client.get('/api/seller/payment-summary')).json()=={'confirmed_count':0,'manual_count':0,'exception_count':0}
    await connection.execute('DROP TRIGGER reject_decision ON idempotency_records')
    result = await decision(client,order,receipt)
    assert result.status_code == 200, result.text
    from app.services.order_service import reset_order_memory_store
    reset_order_memory_store()
    assert (await client.get(path)).json() == result.json()
    assert (await decision(client,order,receipt)).json() == result.json()
    assert await connection.fetchval('SELECT count(*) FROM allocations') == 1
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1
    details = await connection.fetchval("SELECT details FROM audit_events WHERE action='order_confirmed_manual'")
    import json
    assert json.loads(details)['exceptions'] == ['AMOUNT_MISMATCH','SENDER_MISMATCH','TIME_UNCLEAR']
    public = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert public['actual_cod_minor'] == 1050000
    assert 'exceptions' not in public and 'reason' not in public


@pytest.mark.parametrize('rival',['same-key','manual','automatic'])
async def test_manual_serializes_against_manual_and_automatic(postgres_buyer, rival):
    client, connection, _, _ = postgres_buyer
    order, receipt = await exception_case(client,200000)
    async def other():
        if rival != 'automatic':
            return await decision(client,order,receipt,'accept' if rival=='same-key' else 'rival')
        # Completing the receipt invokes automatic reconciliation, inside its shop lock.
        return await client.patch(f"/api/seller/transactions/{receipt['id']}", json={
            'expected_version':receipt['version'],'reason':'Completed app evidence',
            'sender_number':'01822222222','occurred_at':order['created_at']},
            headers={'Idempotency-Key':'auto-correction'})
    await connection.execute('BEGIN')
    await connection.execute('SELECT id FROM shops WHERE id=$1 FOR UPDATE',order['shop_id'])
    tasks = [asyncio.create_task(decision(client,order,receipt)),asyncio.create_task(other())]
    try:
        await wait_for_order_waiters(connection,2)
    finally:
        await connection.execute('COMMIT')
        responses = await asyncio.gather(*tasks)
    assert sorted(r.status_code for r in responses) == ([200,200] if rival=='same-key' else [200,409]), [r.text for r in responses]
    if rival=='same-key':
        assert responses[0].json() == responses[1].json()
    assert await connection.fetchval('SELECT count(*) FROM allocations') == 1
    assert await connection.fetchval('SELECT count(*) FROM used_payment_markers') == 1
    final = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert final['lifecycle']=='confirmed' and final['actual_cod_minor']==1000000
    assert final['version']==order['version']+1

async def test_manual_metrics_are_atomic_private_and_replay_safe(postgres_buyer):
    client, connection, _, _=postgres_buyer
    order,receipt=await exception_case(client)
    result=await decision(client,order,receipt)
    assert result.status_code==200,result.text
    assert (await decision(client,order,receipt)).json()==result.json()
    assert (await client.get('/api/seller/payment-summary')).json()=={'confirmed_count':1,'manual_count':1,'exception_count':1}
    history=(await client.get(f"/api/seller/orders/{order['id']}/payment-decisions")).json()
    assert len(history)==1 and history[0]['reason']=='Accept app evidence'
    columns=await connection.fetch("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='payment_metrics'")
    assert {r['column_name'] for r in columns}=={'shop_id','confirmed_count','manual_count','exception_count'}
