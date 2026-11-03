"""Attention query parity: dashboard list and CSV export share the preview set."""
from collections.abc import Iterator

import pytest
from httpx import AsyncClient
from test_attention_query import (
    add_attempt,
    add_confirmed,
    add_pending,
    preview,
    set_completed,
)
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401

from app.services.courier_attempts import _memory_attempts
from app.services.order_service import _memory_orders

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def clear_attempts() -> Iterator[None]:
    _memory_attempts.clear()
    yield
    _memory_attempts.clear()


async def dashboard_ids(client: AsyncClient) -> list[str]:
    ids: list[str] = []
    cursor = None
    while True:
        params: dict[str, object] = {
            'work_query': 'attention', 'limit': 1, 'status': 'cancelled',
            'search': 'no-such-order', 'from_date': '2000-01-01', 'to_date': '2000-01-02',
        }
        if cursor:
            params['cursor'] = cursor
        response = await client.get('/api/seller/orders', params=params)
        assert response.status_code == 200, response.text
        body = response.json()
        ids.extend(item['id'] for item in body['items'])
        cursor = body['next_cursor']
        if not cursor:
            return ids


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_dashboard_work_query_matches_preview_and_ignores_filters(client: AsyncClient):
    base = await _create_test_order(client)
    _memory_orders[base['id']]['lifecycle'] = 'cancelled'
    unknown = await add_confirmed(client, base, 'dash-unknown')
    pending = await add_pending(client, base, 'dash-pending')
    excluded = await add_confirmed(client, base, 'dash-excluded')
    add_attempt(unknown['id'], 'unknown', minutes=3)
    add_attempt(excluded['id'], 'success', minutes=1)

    expected = [item['order']['id'] for item in (await preview(client))['items']]

    assert expected == [unknown['id'], pending['id']]
    assert await dashboard_ids(client) == expected


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_export_work_query_matches_the_shared_set(client: AsyncClient):
    base = await _create_test_order(client)
    _memory_orders[base['id']]['lifecycle'] = 'cancelled'
    unknown = await add_confirmed(client, base, 'export-unknown')
    preparation = await add_confirmed(client, base, 'export-preparation')
    pending = await add_pending(client, base, 'export-pending')
    booked = await add_confirmed(client, base, 'export-booked')
    add_attempt(unknown['id'], 'unknown', minutes=3)
    add_attempt(booked['id'], 'failed', minutes=2)
    add_attempt(booked['id'], 'success', minutes=1)
    set_completed(preparation['id'], minutes=1)

    response = await client.get('/api/seller/orders/export', params={
        'work_query': 'attention', 'status': 'cancelled', 'search': 'no-such-order',
    })

    assert response.status_code == 200, response.text
    assert response.headers['X-Export-Count'] == '3'
    for order in (unknown, preparation, pending):
        assert order['id'] in response.text
    assert booked['id'] not in response.text
    assert _memory_orders[preparation['id']]['lifecycle'] == 'confirmed'


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
@pytest.mark.parametrize('cursor', ['0:' + '9' * 100 + ':order', '1:-999999999999999999999:order'])
async def test_out_of_range_cursor_restarts_preview_and_dashboard(client: AsyncClient, cursor: str):
    base = await _create_test_order(client)
    _memory_orders[base['id']]['lifecycle'] = 'cancelled'
    pending = await add_pending(client, base, 'invalid-cursor')
    result = await preview(client, cursor=cursor)
    assert [item['order']['id'] for item in result['items']] == [pending['id']]
    response = await client.get('/api/seller/orders', params={
        'work_query': 'attention', 'cursor': cursor,
    })
    assert response.status_code == 200, response.text
    assert [item['id'] for item in response.json()['items']] == [pending['id']]
