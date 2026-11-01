"""Attention work query: membership, priority, ordering, pagination, backlog."""
import datetime
from collections.abc import Iterator

import pytest
from httpx import AsyncClient
from test_courier_drafts import confirm_automatically
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401

from app.services.attention import attention_preview
from app.services.courier_attempts import _memory_attempts
from app.services.order_service import _memory_orders
from app.services.reconciliation_store import _memory_order_review_reasons

pytestmark = pytest.mark.asyncio
UTC = datetime.timezone.utc


@pytest.fixture(autouse=True)
def clear_attempts() -> Iterator[None]:
    _memory_attempts.clear()
    _memory_order_review_reasons.clear()
    yield
    _memory_attempts.clear()
    _memory_order_review_reasons.clear()


def ago(**kwargs: float) -> datetime.datetime:
    return datetime.datetime.now(UTC) - datetime.timedelta(**kwargs)


async def add_order(client: AsyncClient, base: dict, key: str) -> dict:
    response = await client.post('/api/seller/orders', json={
        'product_name': f'Attention order {key}',
        'total_minor': 1200000,
        'required_advance_minor': 200000,
        'payment_account_id': base['payment_account_id'],
    }, headers={'Idempotency-Key': f'attention-order-{key}'})
    assert response.status_code == 201, response.text
    return response.json()


async def add_confirmed(client: AsyncClient, base: dict, key: str) -> dict:
    order = await add_order(client, base, key)
    await confirm_automatically(client, order, f'attention-{key}')
    return order


async def add_pending(client: AsyncClient, base: dict, key: str) -> dict:
    order = await add_order(client, base, key)
    raw = _memory_orders[order['id']]
    raw['lifecycle'] = 'pending'
    raw['first_submitted_at'] = raw['updated_at'] = ago(minutes=5)
    return order


def set_created(order_id: str, **kwargs: float) -> None:
    _memory_orders[order_id]['created_at'] = ago(**kwargs)


def set_completed(order_id: str, **kwargs: float) -> None:
    _memory_orders[order_id]['completed_at'] = ago(**kwargs)


def add_attempt(order_id: str, status: str, **kwargs: float) -> None:
    moment = ago(**kwargs)
    attempts = _memory_attempts.setdefault(order_id, [])
    attempts.append({
        'id': f'{order_id}-attempt-{len(attempts)}',
        'status': status,
        'created_at': moment,
        'updated_at': moment,
    })


async def preview(client: AsyncClient, **params: object) -> dict:
    response = await client.get('/api/seller/work-queries/attention', params=params)
    assert response.status_code == 200, response.text
    return response.json()


async def all_ids(client: AsyncClient, limit: int = 2) -> list[str]:
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
async def test_priority_order_and_categories_with_overlap(client: AsyncClient):
    base = await _create_test_order(client)
    unknown = await add_confirmed(client, base, 'unknown')
    failed = await add_confirmed(client, base, 'failed')
    overlap = await add_pending(client, base, 'overlap')
    coded = await add_pending(client, base, 'coded')
    uncoded = await add_pending(client, base, 'uncoded')
    preparation = await add_confirmed(client, base, 'preparation')
    for order in (unknown, failed, overlap, coded, uncoded, preparation):
        set_created(order['id'], minutes=30)
    add_attempt(unknown['id'], 'unknown', minutes=4)
    add_attempt(failed['id'], 'failed', minutes=3)
    add_attempt(overlap['id'], 'failed', minutes=2)
    _memory_order_review_reasons[coded['id']] = ['COMPETING_CLAIMS']
    set_completed(preparation['id'], minutes=1)

    body = await preview(client)
    ids = [item['order']['id'] for item in body['items']]

    assert body['total'] == 6
    assert ids == [
        unknown['id'], failed['id'], overlap['id'],
        coded['id'], uncoded['id'], preparation['id'],
    ]
    assert [item['category'] for item in body['items']] == [
        'unknown_outcome', 'failed_submission', 'failed_submission',
        'pending_review', 'pending_review', 'preparation',
    ]
    assert body['items'][0]['reason_codes'] == ['UNKNOWN_OUTCOME']
    assert body['items'][1]['reason_codes'] == ['FAILED_SUBMISSION']


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_latest_attempt_decides_and_supersedes_history(client: AsyncClient):
    base = await _create_test_order(client)
    superseded = await add_confirmed(client, base, 'superseded')
    active = await add_confirmed(client, base, 'active')
    recovered = await add_confirmed(client, base, 'recovered')
    pending_success = await add_pending(client, base, 'pending-success')
    add_attempt(superseded['id'], 'failed', minutes=5)
    add_attempt(superseded['id'], 'success', minutes=1)
    add_attempt(active['id'], 'failed', minutes=5)
    add_attempt(active['id'], 'submitting', minutes=1)
    add_attempt(recovered['id'], 'failed', minutes=5)
    add_attempt(recovered['id'], 'unknown', minutes=1)
    add_attempt(pending_success['id'], 'success', minutes=1)

    body = await preview(client)
    ids = [item['order']['id'] for item in body['items']]

    assert ids == [recovered['id']]
    assert body['items'][0]['category'] == 'unknown_outcome'


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_oldest_outstanding_and_id_tie_breaker(client: AsyncClient):
    base = await _create_test_order(client)
    older = await add_confirmed(client, base, 'older')
    newer = await add_confirmed(client, base, 'newer')
    set_completed(older['id'], minutes=30)
    set_completed(newer['id'], minutes=5)
    tied = [await add_confirmed(client, base, f'tied-{index}') for index in range(3)]
    tied_completed_at = ago(minutes=10)
    for order in tied:
        _memory_orders[order['id']]['completed_at'] = tied_completed_at

    body = await preview(client)
    ids = [item['order']['id'] for item in body['items']]

    expected_ties = sorted(order['id'] for order in tied)
    assert ids == [older['id'], *expected_ties, newer['id']]


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_pagination_is_stable_across_pages_and_total_stays_full(client: AsyncClient):
    base = await _create_test_order(client)
    orders = [await add_confirmed(client, base, f'page-{index}') for index in range(5)]
    for index, order in enumerate(orders):
        set_completed(order['id'], minutes=50 - index * 5)

    first = await preview(client, limit=2)
    assert first['total'] == 5
    assert [item['order']['id'] for item in first['items']] == [o['id'] for o in orders[:2]]
    assert first['next_cursor']

    second = await preview(client, limit=2, cursor=first['next_cursor'])
    assert second['total'] == 5
    assert [item['order']['id'] for item in second['items']] == [o['id'] for o in orders[2:4]]
    third = await preview(client, limit=2, cursor=second['next_cursor'])
    assert [item['order']['id'] for item in third['items']] == [orders[4]['id']]
    assert third['next_cursor'] is None
    assert await all_ids(client, limit=2) == [o['id'] for o in orders]


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_cursor_survives_cursor_order_leaving_and_changing_category(client: AsyncClient):
    base = await _create_test_order(client)
    orders = [await add_confirmed(client, base, f'leaving-{index}') for index in range(3)]
    for index, order in enumerate(orders):
        set_completed(order['id'], minutes=30 - index * 5)

    first = await preview(client, limit=2)
    assert [item['order']['id'] for item in first['items']] == [orders[0]['id'], orders[1]['id']]
    assert first['next_cursor']

    # The cursor order moves to a lower-priority category between pages.
    add_attempt(orders[1]['id'], 'failed', minutes=1)
    second = await preview(client, limit=2, cursor=first['next_cursor'])

    assert [item['order']['id'] for item in second['items']] == [orders[2]['id']]
    assert second['next_cursor'] is None


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_unknown_cursor_restarts_at_first_page(client: AsyncClient):
    base = await _create_test_order(client)
    order = await add_confirmed(client, base, 'restart')
    body = await preview(client, cursor='not-a-real-cursor')
    assert [item['order']['id'] for item in body['items']] == [order['id']]


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_prior_day_backlog_reason_and_midnight_boundary(client: AsyncClient):
    base = await _create_test_order(client)
    backlog = await add_confirmed(client, base, 'backlog')
    fresh = await add_confirmed(client, base, 'fresh')
    set_created(backlog['id'], days=2)
    set_completed(backlog['id'], days=2)
    set_created(fresh['id'], minutes=1)
    set_completed(fresh['id'], minutes=1)

    body = await preview(client)
    assert body['items'][0]['reason_codes'] == ['AWAITING_COURIER_PREPARATION', 'PRIOR_DAY_BACKLOG']
    assert body['items'][1]['reason_codes'] == ['AWAITING_COURIER_PREPARATION']

    shop_id = _memory_orders[fresh['id']]['shop_id']
    just_before = datetime.datetime(2026, 11, 1, 17, 59, 59, tzinfo=UTC)  # 23:59:59 Dhaka
    just_after = datetime.datetime(2026, 11, 1, 18, 0, 1, tzinfo=UTC)  # 00:00:01 Dhaka
    _memory_orders[fresh['id']]['created_at'] = just_before
    boundary = await attention_preview(None, shop_id, now=just_after)
    assert 'PRIOR_DAY_BACKLOG' in next(
        item.reason_codes for item in boundary.items if item.order.id == fresh['id']
    )


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_terminal_retained_cross_shop_and_awaiting_orders_are_excluded(client: AsyncClient):
    base = await _create_test_order(client)
    terminal = await add_pending(client, base, 'terminal')
    retained = await add_pending(client, base, 'retained')
    other_shop = await add_pending(client, base, 'other-shop')
    awaiting = await add_order(client, base, 'awaiting')
    for index, lifecycle in enumerate(('cancelled', 'rejected', 'expired')):
        order = await add_pending(client, base, f'terminal-{index}')
        _memory_orders[order['id']]['lifecycle'] = lifecycle
        add_attempt(order['id'], 'failed', minutes=2)
    _memory_orders[terminal['id']]['lifecycle'] = 'cancelled'
    add_attempt(terminal['id'], 'unknown', minutes=2)
    _memory_orders[retained['id']]['retained_at'] = ago(minutes=1)
    _memory_orders[other_shop['id']]['shop_id'] = 'another-shop'

    body = await preview(client)

    assert body['items'] == []
    assert body['total'] == 0
    assert awaiting['id'] not in {item['order']['id'] for item in body['items']}


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_no_matches_and_no_shop_return_valid_empty_pages(client: AsyncClient):
    empty = await preview(client)
    assert empty['items'] == [] and empty['total'] == 0
    assert empty['next_cursor'] is None and empty['calendar_date']
    assert empty['query'] == 'attention' and empty['timezone'] == 'Asia/Dhaka'
    assert datetime.datetime.fromisoformat(empty['retrieved_at'])

    await _create_test_order(client)
    body = await preview(client)
    assert body['items'] == [] and body['total'] == 0


@pytest.mark.usefixtures('clean_memory_stores', 'seller_identity')
async def test_preview_requires_identity(client: AsyncClient):
    from app.core.auth import get_seller_identity
    from app.main import app

    app.dependency_overrides.pop(get_seller_identity, None)
    response = await client.get('/api/seller/work-queries/attention')
    assert response.status_code == 401
