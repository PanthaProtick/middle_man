"""Shared delivery-preparation work query across preview, dashboard, and export."""
import datetime
from collections.abc import Iterator

import pytest
from httpx import AsyncClient
from test_courier_drafts import confirm_automatically
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401

from app.services.courier_attempts import _memory_attempts
from app.services.order_service import _memory_orders

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def clear_attempts() -> Iterator[None]:
    _memory_attempts.clear()
    yield
    _memory_attempts.clear()


async def add_order(client: AsyncClient, base: dict, key: str) -> dict:
    response = await client.post('/api/seller/orders', json={
        'product_name': f'Preparation order {key}',
        'total_minor': 1200000,
        'required_advance_minor': 200000,
        'payment_account_id': base['payment_account_id'],
    }, headers={'Idempotency-Key': f'preparation-order-{key}'})
    assert response.status_code == 201, response.text
    return response.json()


async def add_confirmed(client: AsyncClient, base: dict, key: str) -> dict:
    order = await add_order(client, base, key)
    await confirm_automatically(client, order, f'preparation-{key}')
    return order


def set_times(order_id: str, created_days_ago: int, completed_days_ago: int) -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    raw = _memory_orders[order_id]
    raw['created_at'] = now - datetime.timedelta(days=created_days_ago)
    raw['completed_at'] = now - datetime.timedelta(days=completed_days_ago)


async def preview(client: AsyncClient, **params: object) -> dict:
    response = await client.get('/api/seller/work-queries/preparation', params=params)
    assert response.status_code == 200, response.text
    return response.json()


async def all_preview_ids(client: AsyncClient, limit: int = 2) -> list[str]:
    ids: list[str] = []
    cursor = None
    while True:
        params: dict[str, object] = {'limit': limit}
        if cursor:
            params['cursor'] = cursor
        body = await preview(client, **params)
        ids.extend(item['order']['id'] for item in body['items'])
        cursor = body['next_cursor']
        if not cursor:
            return ids


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_confirmed_order_without_attempts_is_awaiting_preparation(client: AsyncClient):
    base = await _create_test_order(client)
    order = await add_confirmed(client, base, 'basic')

    body = await preview(client)

    assert [item['order']['id'] for item in body['items']] == [order['id']]
    assert body['total'] == 1
    assert body['next_cursor'] is None
    assert body['query'] == 'preparation'
    assert body['timezone'] == 'Asia/Dhaka'
    assert body['calendar_date'] == datetime.datetime.now(
        datetime.timezone.utc).astimezone(datetime.timezone(datetime.timedelta(hours=6))).date().isoformat()
    assert datetime.datetime.fromisoformat(body['retrieved_at'])
    assert body['items'][0]['reason_codes'] == ['AWAITING_COURIER_PREPARATION']
    assert body['items'][0]['order']['lifecycle'] == 'confirmed'


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_non_confirmed_retained_and_cross_shop_orders_are_excluded(client: AsyncClient):
    base = await _create_test_order(client)
    awaiting = await add_order(client, base, 'awaiting')
    retained = await add_confirmed(client, base, 'retained')
    other_shop = await add_confirmed(client, base, 'other-shop')
    cancelled = await add_confirmed(client, base, 'cancelled')
    _memory_orders[retained['id']]['retained_at'] = datetime.datetime.now(datetime.timezone.utc)
    _memory_orders[other_shop['id']]['shop_id'] = 'another-shop'
    _memory_orders[cancelled['id']]['lifecycle'] = 'cancelled'

    body = await preview(client)

    assert body['items'] == []
    assert body['total'] == 0
    assert awaiting['id'] not in {item['order']['id'] for item in body['items']}


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
@pytest.mark.parametrize('statuses', [
    ('failed',),
    ('submitting',),
    ('unknown',),
    ('success',),
    ('failed', 'success'),
    ('success', 'failed'),
    ('failed', 'submitting'),
])
async def test_any_attempt_history_excludes_an_order(client: AsyncClient, statuses: tuple[str, ...]):
    base = await _create_test_order(client)
    order = await add_confirmed(client, base, '-'.join(statuses))
    _memory_attempts[order['id']] = [
        {'id': f'{order["id"]}-attempt-{index}', 'status': status}
        for index, status in enumerate(statuses)
    ]

    body = await preview(client)

    assert body['items'] == []
    assert body['total'] == 0


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_prior_day_backlog_is_oldest_first_with_reason(client: AsyncClient):
    base = await _create_test_order(client)
    recent = await add_confirmed(client, base, 'recent')
    backlog = await add_confirmed(client, base, 'backlog')
    set_times(backlog['id'], created_days_ago=3, completed_days_ago=2)
    set_times(recent['id'], created_days_ago=0, completed_days_ago=0)

    body = await preview(client)

    assert [item['order']['id'] for item in body['items']] == [backlog['id'], recent['id']]
    assert body['items'][0]['reason_codes'] == ['AWAITING_COURIER_PREPARATION', 'PRIOR_DAY_BACKLOG']
    assert body['items'][1]['reason_codes'] == ['AWAITING_COURIER_PREPARATION']


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_no_matches_returns_empty_page_with_valid_retrieval(client: AsyncClient):
    await _create_test_order(client)

    body = await preview(client)

    assert body['items'] == []
    assert body['total'] == 0
    assert body['next_cursor'] is None
    assert body['calendar_date']


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_pagination_survives_cursor_order_leaving_the_match_set(client: AsyncClient):
    base = await _create_test_order(client)
    orders = [await add_confirmed(client, base, f'page-{index}') for index in range(3)]
    for index, order in enumerate(orders):
        set_times(order['id'], created_days_ago=3 - index, completed_days_ago=3 - index)

    first = await preview(client, limit=2)
    assert first['total'] == 3
    assert first['next_cursor'] == orders[1]['id']
    assert [item['order']['id'] for item in first['items']] == [orders[0]['id'], orders[1]['id']]

    # The last order on page one starts submission between pages.
    _memory_attempts[orders[1]['id']] = [{'id': 'late-attempt', 'status': 'submitting'}]
    second = await preview(client, limit=2, cursor=first['next_cursor'])

    assert second['total'] == 2
    assert [item['order']['id'] for item in second['items']] == [orders[2]['id']]
    assert second['next_cursor'] is None


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_preview_requires_identity(client: AsyncClient):
    from app.core.auth import get_seller_identity
    from app.main import app

    app.dependency_overrides.pop(get_seller_identity, None)
    response = await client.get('/api/seller/work-queries/preparation')
    assert response.status_code == 401


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_preview_is_empty_without_a_shop(client: AsyncClient):
    body = await preview(client)
    assert body['items'] == []
    assert body['total'] == 0


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_dashboard_work_query_matches_preview_and_ignores_conflicting_filters(client: AsyncClient):
    base = await _create_test_order(client)
    orders = [await add_confirmed(client, base, f'parity-{index}') for index in range(3)]
    for index, order in enumerate(orders):
        set_times(order['id'], created_days_ago=3 - index, completed_days_ago=3 - index)
    _memory_attempts[orders[1]['id']] = [{'id': 'booked', 'status': 'success'}]

    expected = await all_preview_ids(client)
    assert expected == [orders[0]['id'], orders[2]['id']]

    dashboard_ids: list[str] = []
    cursor = None
    while True:
        params: dict[str, object] = {
            'work_query': 'preparation', 'limit': 1,
            'status': 'cancelled', 'search': 'no-such-order',
            'from_date': '2000-01-01', 'to_date': '2000-01-02',
        }
        if cursor:
            params['cursor'] = cursor
        response = await client.get('/api/seller/orders', params=params)
        assert response.status_code == 200, response.text
        body = response.json()
        dashboard_ids.extend(item['id'] for item in body['items'])
        cursor = body['next_cursor']
        if not cursor:
            break

    assert dashboard_ids == expected


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_export_work_query_matches_the_shared_set(client: AsyncClient):
    base = await _create_test_order(client)
    included = await add_confirmed(client, base, 'export-included')
    booked = await add_confirmed(client, base, 'export-booked')
    pending = await add_order(client, base, 'export-pending')
    _memory_attempts[booked['id']] = [{'id': 'export-attempt', 'status': 'failed'}]

    response = await client.get('/api/seller/orders/export', params={
        'work_query': 'preparation', 'status': 'cancelled', 'search': 'no-such-order',
    })

    assert response.status_code == 200, response.text
    assert response.headers['X-Export-Count'] == '1'
    assert included['id'] in response.text
    assert booked['id'] not in response.text
    assert pending['id'] not in response.text
