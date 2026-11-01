"""Opt-in real transaction tests through the confirmed-order API seam."""
import asyncio


async def test_durable_submission_replays_concurrent_requests_and_survives_new_sessions(postgres_buyer):
    client, _, _, seed = postgres_buyer
    context = (await client.get('/api/seller/order-submissions')).json()
    assert context['storage_epoch'] == 'durable'
    path = '/api/seller/order-submissions/durable.concurrent'
    payload = dict(product_name='Concurrent shirt', total_minor=10000,
                   required_advance_minor=2000, payment_account_id=seed['payment_account_id'])
    responses = await asyncio.gather(*[client.post(path, json=payload) for _ in range(4)])
    assert all(response.status_code == 201 for response in responses)
    ids = {response.json()['id'] for response in responses}
    assert len(ids) == 1
    recovered = (await client.get(path)).json()
    assert recovered['state'] == 'succeeded'
    assert recovered['order']['id'] in ids
    assert len((await client.get('/api/seller/orders')).json()['items']) == 2


async def test_receipt_failure_rolls_back_the_order_before_retry(postgres_buyer):
    client, connection, _, seed = postgres_buyer
    # Database fault injection: reject receipt persistence after the order flush.
    await connection.execute('''
        CREATE FUNCTION reject_creation_receipt() RETURNS trigger AS $$
        BEGIN
            IF NEW.operation = 'create_order' THEN
                RAISE EXCEPTION 'synthetic receipt failure';
            END IF;
            RETURN NEW;
        END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_creation_receipt BEFORE INSERT ON idempotency_records
        FOR EACH ROW EXECUTE FUNCTION reject_creation_receipt();
    ''')
    path = '/api/seller/order-submissions/durable.atomic'
    payload = dict(product_name='Atomic shirt', total_minor=10000,
                   required_advance_minor=2000, payment_account_id=seed['payment_account_id'])
    response = await client.post(path, json=payload)
    assert response.status_code == 500
    assert (await client.get(path)).json()['state'] == 'not_found'
    assert len((await client.get('/api/seller/orders')).json()['items']) == 1
    await connection.execute('DROP TRIGGER reject_creation_receipt ON idempotency_records')
    response = await client.post(path, json=payload)
    assert response.status_code == 201
    assert (await client.get(path)).json()['order']['id'] == response.json()['id']
    assert len((await client.get('/api/seller/orders')).json()['items']) == 2
