import pytest
from httpx import AsyncClient
from transaction_route_support import (
    _setup_shop_and_account,
)
from transaction_route_support import (  # noqa: F401
    clean_stores as clean_stores,
)
from transaction_route_support import (
    seller_client as seller_client,
)

SMS = 'bKash: You have received Tk 150.00 from 01799998877. TrxID SYNTHETIC1 at 2026-10-24T12:00:00+06:00'


@pytest.mark.asyncio
async def test_mixed_import_is_durable_retryable_and_visible(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    payload = {'payment_account_id': setup['account_id'], 'messages': [SMS, 'unsupported text']}
    response = await seller_client.post('/api/seller/transactions/sms-import', json=payload,
                                        headers={'Idempotency-Key': 'sms-mixed'})
    assert response.status_code == 200
    result = response.json()
    assert [item['state'] for item in result['items']] == ['imported', 'unsupported']
    fields = result['items'][0]['fields']
    assert fields['provider'] == 'bkash'
    assert fields['amount_minor'] == 15000
    assert fields['sender_number'] == '01799998877'
    assert fields['occurred_at'] == '2026-10-24T12:00:00+06:00'
    replay = await seller_client.post('/api/seller/transactions/sms-import', json=payload,
                                      headers={'Idempotency-Key': 'sms-mixed'})
    assert replay.json() == result
    inbox = (await seller_client.get('/api/seller/transactions')).json()['items']
    assert len(inbox) == 1
    assert inbox[0]['observations'][0]['source'] == 'sms'
    assert len(inbox[0]['observations']) == 1
    history = await seller_client.get('/api/seller/transactions/sms-imports')
    assert history.json()['items'] == [result]
    assert 'unsupported text' not in history.text

@pytest.mark.asyncio
@pytest.mark.parametrize(('message', 'state'), [
    (SMS.replace('01799998877', '017****8877'), 'masked'),
    (SMS.replace('01799998877', '?'), 'missing'),
    (SMS.replace('+06:00', ''), 'ambiguous'),
    (SMS.replace('2026-10-24T12:00:00+06:00', '24/10/26'), 'ambiguous'),
    (SMS.replace('bKash', 'Nagad'), 'unsupported'),
    (SMS + ' extra receiver 01711111111', 'unsupported'),
])
async def test_uncertain_sms_never_creates_receipt(seller_client: AsyncClient, message: str, state: str) -> None:
    setup = await _setup_shop_and_account(seller_client)
    res = await seller_client.post('/api/seller/transactions/sms-import',
        json={'payment_account_id': setup['account_id'], 'messages': [message]},
        headers={'Idempotency-Key': 'uncertain'})
    assert res.status_code == 200
    assert res.json()['items'][0]['state'] == state
    assert res.json()['items'][0]['receipt_id'] is None
    assert (await seller_client.get('/api/seller/transactions')).json()['items'] == []


@pytest.mark.asyncio
async def test_duplicates_conflicts_and_raw_deadline_do_not_change_payment_value(seller_client: AsyncClient) -> None:
    from datetime import datetime
    setup = await _setup_shop_and_account(seller_client)
    payload = {'payment_account_id': setup['account_id'], 'messages': [SMS, SMS, SMS.replace('150.00', '151.00')]}
    first = await seller_client.post('/api/seller/transactions/sms-import', json=payload,
                                     headers={'Idempotency-Key': 'dupes'})
    items = first.json()['items']
    assert [i['state'] for i in items] == ['conflicting', 'conflicting', 'conflicting']
    assert items[0]['evidence_id'] == items[1]['evidence_id']
    assert items[0]['delete_after'] == items[1]['delete_after']
    assert (datetime.fromisoformat(items[0]['delete_after']) - datetime.fromisoformat(items[0]['collected_at'])).days == 30
    assert len({i['receipt_id'] for i in items}) == 1
    inbox = (await seller_client.get('/api/seller/transactions')).json()['items']
    assert len(inbox) == 1
    assert inbox[0]['amount_minor'] == 15000
    assert inbox[0]['has_conflict'] is True
    changed = await seller_client.post('/api/seller/transactions/sms-import',
        json={**payload, 'messages': ['changed']}, headers={'Idempotency-Key': 'dupes'})
    assert changed.status_code == 409


@pytest.mark.asyncio
async def test_import_limits_permissions_and_private_errors(seller_client: AsyncClient) -> None:
    from httpx import ASGITransport

    from app.main import app
    setup = await _setup_shop_and_account(seller_client)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as anonymous:
        assert (await anonymous.get('/api/seller/transactions/sms-imports')).status_code == 401
        assert (await anonymous.post('/api/seller/transactions/sms-import', json={}, headers={'Idempotency-Key': 'anon'})).status_code == 401
    for messages, expected in [([SMS] * 51, 422), (['অ' * 22000], 413), ([], 422)]:
        res = await seller_client.post('/api/seller/transactions/sms-import',
            json={'payment_account_id': setup['account_id'], 'messages': messages},
            headers={'Idempotency-Key': 'limit'})
        assert res.status_code == expected
        assert SMS not in res.text
    foreign = await seller_client.post('/api/seller/transactions/sms-import',
        json={'payment_account_id': 'foreign', 'messages': [SMS]}, headers={'Idempotency-Key': 'foreign'})
    assert foreign.status_code == 404
