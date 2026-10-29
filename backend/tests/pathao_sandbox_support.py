"""Sandbox transport at the courier boundary and through the seller workflow."""

import httpx
import pytest
from test_courier_drafts import confirm_automatically, parcel_order

CREDENTIALS = {'client_id': 'sandbox-client', 'client_secret': 'sandbox-secret',
               'username': 'sandbox@example.test', 'password': 'sandbox-password'}
CONSIGNMENT = 'PT-SANDBOX-9001'


@pytest.fixture(autouse=True)
def sandbox_settings(monkeypatch):
    from cryptography.fernet import Fernet

    from app.core.config import settings
    from app.services.courier_attempts import _memory_attempts
    from app.services.pathao_catalog import clear_cache
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    _memory.clear()
    _memory_attempts.clear()
    clear_cache()
    yield
    _memory.clear()
    _memory_attempts.clear()
    clear_cache()


def provider_router(monkeypatch, *, create=None, lookup=None):
    calls: list[httpx.Request] = []

    async def handler(request: httpx.Request):
        calls.append(request)
        path = request.url.path
        if path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60,
                                             'access_token': 'sandbox-access-token'})
        if path.endswith('/stores'):
            return httpx.Response(200, json={'data': {
                'data': [{'store_id': 321, 'store_name': 'Sandbox pickup', 'is_active': 1}],
                'current_page': 1, 'last_page': 1,
            }})
        if path.endswith('/city-list'):
            return httpx.Response(200, json={'data': [{'city_id': 1, 'city_name': 'Dhaka'}]})
        if path.endswith('/cities/1/zone-list'):
            return httpx.Response(200, json={'data': [{'zone_id': 10, 'zone_name': 'Central'}]})
        if path.endswith('/zones/10/area-list'):
            return httpx.Response(200, json={'data': [
                {'area_id': 100, 'area_name': 'Covered', 'home_delivery_available': True},
            ]})
        if request.method == 'POST' and path.endswith('/aladdin/api/v1/orders'):
            return create() if create else httpx.Response(200, json={
                'type': 'success', 'code': 200, 'message': 'Order created',
                'data': {'consignment_id': CONSIGNMENT, 'merchant_order_id': None,
                         'order_status': 'Pending', 'delivery_fee': 60},
            })
        if path.endswith(f'/orders/{CONSIGNMENT}/info'):
            return lookup() if lookup else httpx.Response(200, json={
                'type': 'success', 'code': 200, 'message': 'Order info',
                'data': {'consignment_id': CONSIGNMENT, 'merchant_order_id': None,
                         'store_id': 321, 'order_status': 'Pending'},
            })
        raise AssertionError(f'Unexpected provider request: {request.method} {request.url}')

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(handler))
    return calls


def create_calls(calls: list[httpx.Request]) -> list[httpx.Request]:
    return [call for call in calls
            if call.method == 'POST' and call.url.path.endswith('/aladdin/api/v1/orders')]


async def sandbox_review(client, monkeypatch, key: str):
    calls = provider_router(monkeypatch)
    await client.post('/api/seller/shop', json={'display_name': 'Sandbox shop'})
    connected = await client.put('/api/seller/courier/pathao/sandbox',
                                 json={'expected_version': 0, 'credentials': CREDENTIALS})
    assert connected.status_code == 200, connected.text
    order = await parcel_order(client, f'{key}-order', parcel_weight_grams=1200, parcel_quantity=3)
    await confirm_automatically(client, order, f'{key}-receipt')
    path = f"/api/seller/orders/{order['id']}/courier-review"
    current = (await client.get(path)).json()
    selected = await client.put(path, json={
        'expected_token': current['token'], 'environment': 'sandbox',
        'store_id': 321, 'delivery_type': 48,
        'location': {'city_id': 1, 'zone_id': 10, 'area_id': 100},
    })
    assert selected.status_code == 200, selected.text
    ready = selected.json()
    assert ready['blockers'] == [], ready
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200, approved.text
    return order, path, ready, calls


def booking_snapshot(**overrides):
    from app.models.courier_submission import CourierBookingSnapshot
    base = dict(
        order_id='order-sandbox-1', recipient_name='Sandbox Buyer',
        recipient_phone='01711111111', recipient_address='House 1, Road 2, Dhaka',
        city_id=1, zone_id=10, area_id=100, store_id=321, delivery_type=48,
        item_weight_grams=1200, item_quantity=2,
        amount_to_collect_bdt=500, remaining_cod_minor=50000,
    )
    return CourierBookingSnapshot(**{**base, **overrides})


def sandbox_credentials():
    from app.models.pathao import MerchantCredentials
    return MerchantCredentials(**CREDENTIALS)
