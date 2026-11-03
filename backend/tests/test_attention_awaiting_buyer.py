"""Awaiting-buyer attention membership stays shared with dashboard and export."""
import pytest
from httpx import AsyncClient
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401


@pytest.mark.asyncio
@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_awaiting_buyer_attention_preview_dashboard_and_export(client: AsyncClient):
    order = await _create_test_order(client)
    response = await client.get('/api/seller/work-queries/attention', params={'limit': 1})
    assert response.status_code == 200
    body = response.json()
    assert body['total'] == 1
    assert body['items'][0]['order']['id'] == order['id']
    assert body['items'][0]['category'] == 'awaiting_buyer'
    assert 'AWAITING_BUYER_SUBMISSION' in body['items'][0]['reason_codes']
    dashboard = await client.get('/api/seller/orders', params={'work_query': 'attention'})
    assert dashboard.status_code == 200
    assert [item['id'] for item in dashboard.json()['items']] == [order['id']]
    export = await client.get('/api/seller/orders/export', params={'work_query': 'attention'})
    assert export.status_code == 200
    assert export.headers['X-Export-Count'] == '1'
    assert order['id'] in export.text

@pytest.mark.asyncio
@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_awaiting_buyer_cursor_paginates_without_restarting(client: AsyncClient):
    from test_attention_query import add_order

    first_order = await _create_test_order(client)
    second_order = await add_order(client, first_order, 'awaiting-next')
    first = await client.get('/api/seller/work-queries/attention', params={'limit': 1})
    assert first.status_code == 200
    body = first.json()
    assert body['total'] == 2
    assert body['next_cursor'].startswith('4:')
    second = await client.get('/api/seller/work-queries/attention', params={
        'limit': 1, 'cursor': body['next_cursor'],
    })
    assert second.status_code == 200
    assert second.json()['next_cursor'] is None
    ids = {body['items'][0]['order']['id'], second.json()['items'][0]['order']['id']}
    assert ids == {first_order['id'], second_order['id']}
