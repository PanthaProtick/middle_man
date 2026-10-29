import asyncio
import datetime

import pytest
from buyer_postgres_support import wait_for_order_waiters


@pytest.mark.asyncio



async def test_postgres_correction_races_allocation_without_overwriting_confirmation(postgres_buyer):



    client, connection, _, order = postgres_buyer



    payment_time = datetime.datetime.now(datetime.timezone.utc)



    claim = {'provider': 'bkash', 'trx_id': 'RACE-CORRECT', 'sender_number': '01822222222', 'amount_minor': 200000}



    assert (await client.post(f"/api/public/orders/{order['portal_token']}/submission", json={



        'buyer_name': 'Buyer', 'contact_number': '01711111111', 'address': {'raw_text': 'Dhaka'},



        'payment_claim': claim}, headers={'Idempotency-Key': 'claim'})).status_code == 200



    path = f"/api/seller/orders/{order['id']}"



    async with connection.transaction():



        await connection.execute('SELECT id FROM shops WHERE id=$1 FOR UPDATE', order['shop_id'])



        correction = asyncio.create_task(client.patch(path + '/buyer-details', json={



            'expected_version': 2, 'reason': 'Correct before allocation',



            'payment_claim': {**claim, 'sender_number': '01933333333'}}, headers={'Idempotency-Key': 'correct'}))



        receipt = asyncio.create_task(client.post('/api/seller/transactions', json={



            'payment_account_id': order['payment_account_id'], **claim,



            'occurred_at': payment_time.isoformat()}, headers={'Idempotency-Key': 'receipt'}))



        await wait_for_order_waiters(connection, 2)



    edited, received = await asyncio.gather(correction, receipt)



    assert received.status_code == 201



    assert edited.status_code in (200, 409)



    final = (await client.get(path)).json()



    revisions = (await client.get(path + '/history')).json()['items']



    if edited.status_code == 200:



        assert final['lifecycle'] == 'pending'



        assert final['review_reasons'] == ['SENDER_MISMATCH']



        assert len(revisions) == 2



    else:



        assert final['lifecycle'] == 'confirmed'



        assert len(revisions) == 1



    assert revisions[0]['payment_claim']['sender_number'] == '01822222222'



    assert final['actual_cod_minor'] == (1000000 if final['lifecycle'] == 'confirmed' else None)
