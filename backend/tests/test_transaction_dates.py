"""Recorded-date filtering at the seller HTTP boundary."""
import datetime

import pytest
from httpx import AsyncClient
from test_transaction_routes import _setup_shop_and_account
from test_transaction_routes import clean_stores as clean_stores
from test_transaction_routes import seller_client as seller_client

from app.services.transaction_store import _memory_transactions


@pytest.mark.asyncio
async def test_recorded_dates_are_inclusive_dhaka_days_before_paging(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    ids = []
    for index, timestamp in enumerate([
        '2026-10-26T17:59:59+00:00', '2026-10-26T18:00:00+00:00',
        '2026-10-27T17:59:59+00:00', '2026-10-27T18:00:00+00:00',
    ]):
        response = await seller_client.post('/api/seller/transactions', json={
            'payment_account_id': setup['account_id'], 'provider': 'bkash',
            'trx_id': f'DATE-{index}', 'amount_minor': 15000,
        })
        receipt_id = response.json()['id']
        ids.append(receipt_id)
        _memory_transactions[receipt_id]['created_at'] = datetime.datetime.fromisoformat(timestamp)
    params = {'from_date': '2026-10-27', 'to_date': '2026-10-27',
              'parse': 'incomplete', 'search': 'Primary', 'limit': 1}
    response = await seller_client.get('/api/seller/transactions', params=params)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store, private'
    page = response.json()
    assert [row['id'] for row in page['items']] == [ids[2]]
    page = (await seller_client.get('/api/seller/transactions', params={
        **params, 'cursor': page['next_cursor'],
    })).json()
    assert [row['id'] for row in page['items']] == [ids[1]]
    assert page['next_cursor'] is None


@pytest.mark.asyncio
@pytest.mark.parametrize('params', [
    {'from_date': '2026-02-30'}, {'to_date': 'garbage'},
    {'from_date': '2026-10-28', 'to_date': '2026-10-27'},
])
async def test_invalid_recorded_dates_rejected(seller_client: AsyncClient, params: dict[str, str]) -> None:
    await _setup_shop_and_account(seller_client)
    assert (await seller_client.get('/api/seller/transactions', params=params)).status_code == 422


@pytest.mark.asyncio
async def test_retained_cursor_does_not_restart_date_filtered_pages(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    ids = []
    for index in range(3):
        response = await seller_client.post('/api/seller/transactions', json={
            'payment_account_id': setup['account_id'], 'provider': 'bkash',
            'trx_id': f'CURSOR-{index}', 'amount_minor': 15000,
        })
        receipt_id = response.json()['id']
        ids.append(receipt_id)
        _memory_transactions[receipt_id]['created_at'] = datetime.datetime(
            2026, 10, 27, index, tzinfo=datetime.timezone.utc,
        )
    params = {'from_date': '2026-10-27', 'to_date': '2026-10-27', 'limit': 2}
    page = (await seller_client.get('/api/seller/transactions', params=params)).json()
    assert [row['id'] for row in page['items']] == [ids[2], ids[1]]
    _memory_transactions[ids[1]]['retained_at'] = datetime.datetime.now(datetime.timezone.utc)
    page = (await seller_client.get('/api/seller/transactions', params={
        **params, 'cursor': page['next_cursor'],
    })).json()
    assert [row['id'] for row in page['items']] == [ids[0]]
    assert page['next_cursor'] is None
