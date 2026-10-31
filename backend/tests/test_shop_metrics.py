import datetime as dt
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.services.shop_metrics import today_shop_metrics

NOW = dt.datetime(2026, 10, 30, 20, tzinfo=dt.timezone.utc)
START = NOW.replace(hour=18)


@pytest.mark.asyncio
async def test_daily_metrics_bounds_scope_retention_and_expiry(monkeypatch: pytest.MonkeyPatch) -> None:
    orders = {}
    for index, (shop, created, state, retained) in enumerate([
        ('s1', START, 'confirmed', None),
        ('s1', START - dt.timedelta(microseconds=1), 'confirmed', None),
        ('s1', START + dt.timedelta(days=1), 'pending', None),
        ('s2', NOW, 'confirmed', None),
        ('s1', NOW, 'pending', NOW),
        ('s1', NOW, 'awaiting_buyer', None),
        ('s1', NOW, 'pending', None),
        ('s1', NOW, 'cancelled', None),
    ]):
        orders[str(index)] = dict(shop_id=shop, created_at=created, lifecycle=state,
                                  retained_at=retained, expires_at=NOW)
    monkeypatch.setattr('app.services.shop_metrics._memory_orders', orders)
    monkeypatch.setattr('app.services.shop_metrics._memory_transactions', {
        'a': dict(shop_id='s1', created_at=START),
        'b': dict(shop_id='s1', created_at=START - dt.timedelta(seconds=1)),
        'c': dict(shop_id='s2', created_at=NOW),
        'd': dict(shop_id='s1', created_at=NOW, retained_at=NOW),
    })
    result = await today_shop_metrics(None, 's1', NOW)
    assert result.model_dump(mode='json') == dict(date='2026-10-31', timezone='Asia/Dhaka',
                                                orders=4, confirmed=1, awaiting=0, pending=1, payments=1)
    assert (await today_shop_metrics(None, 'empty', NOW)).orders == 0


@pytest.mark.asyncio
async def test_sql_aggregates_all_daily_rows_without_pagination() -> None:
    db = AsyncMock()
    rows = MagicMock()
    rows.all.return_value = [('confirmed', 120), ('pending', 60), ('cancelled', 4)]
    db.execute.return_value = rows
    db.scalar.return_value = 200
    result = await today_shop_metrics(db, 'shop-a', NOW)
    assert (result.orders, result.confirmed, result.pending, result.payments) == (184, 120, 60, 200)
    for call in [db.execute.call_args, db.scalar.call_args]:
        query = call.args[0]
        assert 'LIMIT' not in str(query)
        params = query.compile().params
        assert 'shop-a' in params.values()
        assert START in params.values()
        assert START + dt.timedelta(days=1) in params.values()


@pytest.mark.asyncio
async def test_metrics_endpoint_auth_missing_shop_and_owner_scope(client: AsyncClient) -> None:
    assert (await client.get('/api/seller/metrics/today')).status_code == 401
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='daily-owner')
    try:
        assert (await client.get('/api/seller/metrics/today')).status_code == 404
        await client.post('/api/seller/shop', json={'display_name': 'Daily Shop'})
        response = await client.get('/api/seller/metrics/today')
        assert response.status_code == 200
        assert response.json()['orders'] == 0
        assert response.json()['timezone'] == 'Asia/Dhaka'
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)
