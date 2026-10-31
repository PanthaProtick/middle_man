"""Retired catalogue routes return 404 and connection lifecycle leaves buyer on-demand behavior intact."""
import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401

from app.core.auth import get_seller_identity
from app.core.config import settings
from app.main import app
from app.services import pathao_connections as connections


@pytest.mark.usefixtures('seller_identity')
async def test_retired_catalog_routes_return_404_and_on_demand_works(client, monkeypatch):
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    monkeypatch.setattr(connections, '_memory', {})
    order = await _create_test_order(client)
    path = '/api/seller/courier/pathao/offline'
    public = f"/api/public/orders/{order['portal_token']}/pathao-locations"

    # Retired endpoints return 404
    assert (await client.get(path + '/catalog')).status_code == 404
    assert (await client.post(path + '/catalog/refresh')).status_code == 404

    # Connecting does not trigger a crawl; buyer choices resolve on demand immediately
    connect_res = await client.put(path, json={'expected_version': 0})
    assert connect_res.status_code == 200
    locations_res = await client.get(public)
    assert locations_res.status_code == 200
    assert locations_res.json()['condition'] == 'resolved'

    # Retired endpoints still return 404 while connected
    assert (await client.get(path + '/catalog')).status_code == 404
    assert (await client.post(path + '/catalog/refresh')).status_code == 404

    # Disconnecting updates buyer state
    disconnect_res = await client.delete(path + '?expected_version=1')
    assert disconnect_res.status_code == 200
    assert disconnect_res.json()['status'] == 'disconnected'
    assert (await client.get(public)).json()['condition'] == 'disconnected'

    # Reconnection works immediately on demand without catalogue synchronization
    replacement = await client.put(path, json={'expected_version': 2})
    assert replacement.status_code == 200
    assert (await client.get(public)).json()['condition'] == 'resolved'

    # Unauthenticated requests return 401
    app.dependency_overrides.pop(get_seller_identity, None)
    for method, suffix in [('GET', ''), ('DELETE', '?expected_version=3')]:
        unauthed = await client.request(method, path + suffix)
        assert unauthed.status_code == 401
