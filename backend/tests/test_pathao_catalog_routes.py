"""Authenticated catalogue operations and buyer behavior across refresh failures."""
import datetime as dt

import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.config import settings
from app.main import app
from app.services import pathao_connections as connections
from app.services import pathao_snapshot_jobs as jobs
from app.services import pathao_snapshot_store as store
from app.services import pathao_snapshot_sync as sync


@pytest.mark.usefixtures('seller_identity')
async def test_refresh_failure_status_authority_and_reconnection(client, monkeypatch):
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    monkeypatch.setattr(connections, '_memory', {})
    monkeypatch.setattr(jobs, '_jobs', {})
    monkeypatch.setattr(store, '_snapshots', {})
    order = await _create_test_order(client)
    path = '/api/seller/courier/pathao/offline'
    public = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    assert (await client.put(path, json={'expected_version': 0})).status_code == 200
    original = (await client.get(public)).json()
    status = (await client.get(path + '/catalog')).json()
    assert status['catalog_version'] == original['catalog_version']
    assert status['refreshed_at'] and not status['failed']
    now = jobs.get_utc_now() + dt.timedelta(minutes=2)
    monkeypatch.setattr(jobs, 'get_utc_now', lambda: now)
    original_crawl = sync.crawl
    async def unavailable(*args):
        raise ValueError('private upstream diagnostic')
    monkeypatch.setattr(sync, 'crawl', unavailable)
    result = await client.post(path + '/catalog/refresh')
    assert result.status_code == 202
    failure = await client.get(path + '/catalog')
    assert failure.json()['failed'] and not failure.json()['refreshing']
    assert 'private upstream' not in failure.text
    assert (await client.get(public)).json() == original
    assert (await client.delete(path + '?expected_version=1')).json()['status'] == 'disconnected'
    assert (await client.get(public)).json()['condition'] == 'disconnected'
    # A replacement whose initial download fails cannot reuse the old merchant's catalogue.
    replacement = await client.put(path, json={'expected_version': 2})
    assert replacement.status_code == 200
    assert (await client.get(public)).json()['condition'] == 'unavailable'
    now += dt.timedelta(minutes=2)
    monkeypatch.setattr(sync, 'crawl', original_crawl)
    assert (await client.post(path + '/catalog/refresh')).status_code == 202
    assert (await client.get(public)).json()['catalog_version'] != original['catalog_version']
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('other-catalog-owner')
    await client.post('/api/seller/shop', json={'display_name': 'Other'})
    assert (await client.get(path + '/catalog')).json()['catalog_version'] is None
    app.dependency_overrides.pop(get_seller_identity)
    for method, suffix in [('GET', '/catalog'), ('POST', '/catalog/refresh'), ('DELETE', '?expected_version=3')]:
        assert (await client.request(method, path + suffix)).status_code == 401
