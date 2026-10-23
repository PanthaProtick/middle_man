"""Real loopback PostgreSQL acceptance through seller/buyer HTTP seams."""
import asyncio
import datetime

import pytest
from test_sms_import import SMS


@pytest.mark.asyncio
async def test_postgres_import_survives_retry_raw_deletion_and_restart(postgres_buyer):
    client, connection, _, order = postgres_buyer
    account_id = order['payment_account_id']
    payload = {'payment_account_id': account_id, 'messages': [SMS, 'unrecognized']}
    responses = await asyncio.gather(*[
        client.post('/api/seller/transactions/sms-import', json=payload, headers={'Idempotency-Key': 'concurrent'})
        for _ in range(2)
    ])
    assert [r.status_code for r in responses] == [200, 200]
    assert responses[0].json() == responses[1].json()
    original = responses[0].json()
    assert [i['state'] for i in original['items']] == ['imported', 'unsupported']
    # Simulate the future cleanup worker erasing raw originals independently.
    await connection.execute('UPDATE sms_evidence SET raw_text = NULL')
    from app.services.sms_import import reset_sms_store
    reset_sms_store()
    history = (await client.get('/api/seller/transactions/sms-imports')).json()
    assert history['items'] == [original]
    again = await client.post('/api/seller/transactions/sms-import', json=payload,
                              headers={'Idempotency-Key': 'after-deletion'})
    assert again.status_code == 200
    assert again.json()['items'][0]['state'] == 'duplicate'
    assert again.json()['items'][0]['evidence_id'] == original['items'][0]['evidence_id']
    assert again.json()['items'][0]['delete_after'] == original['items'][0]['delete_after']
    assert await connection.fetchval('SELECT count(*) FROM sms_evidence WHERE raw_text IS NOT NULL') == 0
    inbox = (await client.get('/api/seller/transactions')).json()['items']
    assert len(inbox) == 1
    assert inbox[0]['amount_minor'] == 15000


@pytest.mark.asyncio
@pytest.mark.parametrize('receipt_first', [True, False])
async def test_postgres_sms_reconciles_both_arrival_orders(postgres_buyer, receipt_first):
    client, _, _, order = postgres_buyer
    when = datetime.datetime.now(datetime.timezone.utc).isoformat()
    message = f'bKash: You have received Tk 2000.00 from 01822222222. TrxID SMS-MATCH at {when}'
    submission = {
        'buyer_name': 'Synthetic Buyer', 'contact_number': '01711111111',
        'address': {'raw_text': 'Synthetic Dhaka address'},
        'payment_claim': {'provider': 'bkash', 'trx_id': 'SMS-MATCH', 'sender_number': '01822222222', 'amount_minor': 200000},
    }
    async def receipt():
        return await client.post('/api/seller/transactions/sms-import',
            json={'payment_account_id': order['payment_account_id'], 'messages': [message]},
            headers={'Idempotency-Key': 'match'})
    async def claim():
        return await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=submission,
                                 headers={'Idempotency-Key': 'claim'})
    first, second = (receipt, claim) if receipt_first else (claim, receipt)
    assert (await first()).status_code == 200
    assert (await second()).status_code == 200
    seller = await client.get(f"/api/seller/orders/{order['id']}")
    assert seller.json()['lifecycle'] == 'confirmed'
    assert seller.json()['actual_cod_minor'] == order['total_minor'] - 200000

@pytest.mark.asyncio
@pytest.mark.parametrize('reverse', [False, True])
async def test_batch_conflict_prevents_new_allocation_in_either_order(postgres_buyer, reverse):
    client, _, _, order = postgres_buyer
    when = datetime.datetime.now(datetime.timezone.utc).isoformat()
    message = f'bKash: You have received Tk 2000.00 from 01822222222. TrxID BATCH-CONFLICT at {when}'
    claim = {'buyer_name': 'Synthetic Buyer', 'contact_number': '01711111111',
             'address': {'raw_text': 'Synthetic address'},
             'payment_claim': {'provider': 'bkash', 'trx_id': 'BATCH-CONFLICT', 'sender_number': '01822222222', 'amount_minor': 200000}}
    assert (await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=claim,
                             headers={'Idempotency-Key': 'claim'})).status_code == 200
    messages = [message, message.replace('2000.00', '2001.00')]
    if reverse:
        messages.reverse()
    response = await client.post('/api/seller/transactions/sms-import',
        json={'payment_account_id': order['payment_account_id'], 'messages': messages},
        headers={'Idempotency-Key': 'conflict'})
    assert response.status_code == 200
    seller = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert seller['lifecycle'] == 'pending'
    assert seller['actual_cod_minor'] is None
    assert all(not item['order_ids'] for item in response.json()['items'])
