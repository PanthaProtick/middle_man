import pytest
from httpx import AsyncClient
from transaction_route_support import _setup_shop_and_account
from transaction_route_support import clean_stores as clean_stores  # noqa: F401
from transaction_route_support import seller_client as seller_client


@pytest.mark.asyncio
async def test_retired_sms_routes_do_not_ingest_or_disclose(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    response = await seller_client.post('/api/seller/transactions/sms-import', json={
        'payment_account_id': setup['account_id'],
        'messages': ['bKash: You have received Tk 150.00 from 01799998877. TrxID RETIRED at 2026-10-24T12:00:00+06:00'],
    }, headers={'Idempotency-Key': 'retired-import'})
    assert response.status_code == 404
    assert (await seller_client.get('/api/seller/transactions/sms-imports')).status_code == 404
    assert (await seller_client.get('/api/seller/transactions')).json()['items'] == []


@pytest.mark.asyncio
@pytest.mark.parametrize('method', ['GET', 'POST', 'PATCH', 'DELETE'])
@pytest.mark.parametrize('name', ['sms-import', 'sms-imports'])
@pytest.mark.parametrize('suffix', ['', '/'])
async def test_retired_names_are_private_not_found(seller_client, method, name, suffix):
    response = await seller_client.request(method, f'/api/seller/transactions/{name}{suffix}')
    assert response.status_code == 404
    assert response.headers['cache-control'] == 'no-store, private'
