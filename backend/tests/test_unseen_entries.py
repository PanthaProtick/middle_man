import datetime as dt
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.models.unseen_entries import UnseenEntryQuery
from app.services.unseen_entries import unseen_entry_counts

NOW = dt.datetime(2026, 10, 31, 10, tzinfo=dt.timezone.utc)
SINCE = NOW - dt.timedelta(hours=1)


@pytest.mark.asyncio
async def test_unseen_scope_bounds_retention_and_first_visit(monkeypatch: pytest.MonkeyPatch) -> None:
    rows = {str(i): dict(shop_id=shop, created_at=created, retained_at=retained)
            for i, (shop, created, retained) in enumerate([
                ('a', SINCE, None), ('a', NOW, None),
                ('a', SINCE + dt.timedelta(seconds=1), None),
                ('a', NOW + dt.timedelta(seconds=1), None),
                ('b', NOW, None), ('a', NOW, NOW),
            ])}
    for name in ('orders', 'transactions', 'accounts'):
        monkeypatch.setattr(f'app.services.unseen_entries._memory_{name}', rows)
    query = UnseenEntryQuery(orders_since=SINCE, payments_since=SINCE, accounts_since=SINCE)
    result = await unseen_entry_counts(None, 'a', query, NOW)
    assert (result.orders, result.payments, result.accounts) == (2, 2, 2)
    assert result.captured_at == NOW
    initial = await unseen_entry_counts(None, 'a', UnseenEntryQuery(), NOW)
    assert (initial.orders, initial.payments, initial.accounts) == (0, 0, 0)


@pytest.mark.asyncio
async def test_sql_counts_are_unpaginated_and_scoped() -> None:
    db = AsyncMock()
    db.scalar.side_effect = [150, 200, 3]
    query = UnseenEntryQuery(orders_since=SINCE, payments_since=SINCE, accounts_since=SINCE)
    result = await unseen_entry_counts(db, 'shop-a', query, NOW)
    assert (result.orders, result.payments, result.accounts) == (150, 200, 3)
    for index, call in enumerate(db.scalar.call_args_list):
        statement = call.args[0]
        assert 'LIMIT' not in str(statement)
        assert ('retained_at IS NULL' in str(statement)) == (index < 2)
        assert set(statement.compile().params.values()) == {'shop-a', SINCE, NOW}


@pytest.mark.asyncio
async def test_endpoint_auth_shop_and_timestamp_validation(client: AsyncClient) -> None:
    path = '/api/seller/unseen-entries'
    assert (await client.get(path)).status_code == 401
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id='unseen-owner')
    try:
        assert (await client.get(path)).status_code == 404
        await client.post('/api/seller/shop', json={'display_name': 'Unseen Shop'})
        response = await client.get(path)
        assert response.status_code == 200
        assert response.json()['orders'] == 0
        for timestamp in ('invalid', '2026-10-31T10:00:00'):
            assert (await client.get(path, params={'orders_since': timestamp})).status_code == 422
    finally:
        app.dependency_overrides.pop(get_seller_identity, None)
