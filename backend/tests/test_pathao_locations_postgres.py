"""Disposable PostgreSQL HTTP acceptance, including erasure and tenant authority."""
import datetime as dt

import pytest
from buyer_postgres_support import PAYLOAD

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app


@pytest.mark.parametrize('connected,location,condition', [
    (False, {}, 'disconnected'),
    (True, {'city_id': 1, 'zone_id': 10, 'area_id': 100}, 'resolved'),
    (True, {'city_id': 1, 'zone_id': 11}, 'no_area_unverified'),
    (True, {'city_id': 1, 'zone_id': 10, 'area_id': 101}, 'unsupported'),
])
async def test_restart_history_authority_and_location_erasure(postgres_buyer, monkeypatch, connected, location, condition):
    from app.core.config import settings
    from app.services.pathao_catalog import clear_cache
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    client, connection, _, order = postgres_buyer
    if connected:
        assert (await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})).status_code == 200
    public = f"/api/public/orders/{order['portal_token']}"
    payload = {**PAYLOAD, 'address': {'raw_text': 'House 12, Street 5. Call at gate.', 'pathao': location}}
    result = await client.post(public + '/submission', json=payload, headers={'Idempotency-Key': 'persist'})
    assert result.status_code == 200, result.text
    clear_cache()
    _memory.clear()
    path = f"/api/seller/orders/{order['id']}"
    item = (await client.get(path + '/history')).json()['items'][0]
    assert item['address']['pathao']['condition'] == condition
    assert item['address']['raw_text'] == payload['address']['raw_text']
    assert item['payment_claim']['trx_id'] == PAYLOAD['payment_claim']['trx_id']
    assert item['address']['pathao']['booking_blocked'] is True
    # Public status never projects the buyer's destination or claim.
    assert 'House 12' not in (await client.get(public)).text
    original = app.dependency_overrides[get_seller_identity]
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('foreign-location-reader')
    await client.post('/api/seller/shop', json={'display_name': 'Other shop'})
    assert (await client.get(path + '/history')).status_code == 404
    app.dependency_overrides[get_seller_identity] = original
    # Controlled retention boundary; assert both API denial and actual sensitive-row erasure.
    completed = dt.datetime(2024, 1, 1, tzinfo=dt.timezone.utc)
    await connection.execute("UPDATE orders SET lifecycle='cancelled', completed_at=$1 WHERE id=$2", completed, order['id'])
    monkeypatch.setattr('app.api.structured_retention.get_utc_now', lambda: dt.datetime(2026, 1, 2, tzinfo=dt.timezone.utc))
    removed = await client.post('/api/seller/retention/structured/cleanup')
    assert removed.status_code == 200, removed.text
    assert removed.json()['removed'] == 1
    assert (await client.get(path + '/history')).status_code == 410
    assert await connection.fetchval('SELECT count(*) FROM buyer_revisions WHERE order_id=$1', order['id']) == 0
    assert (await client.post(public + '/submission', json=payload, headers={'Idempotency-Key': 'persist'})).status_code == 410
