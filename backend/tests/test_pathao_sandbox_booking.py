"""Sandbox transport at the courier boundary and through the seller workflow."""
import json

import httpx
import pytest
from test_courier_drafts import confirm_automatically, parcel_order
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401

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


@pytest.mark.usefixtures('seller_identity')
async def test_sandbox_submission_sends_exact_server_facts_and_records_consignment(client, monkeypatch):
    order, path, ready, calls = await sandbox_review(client, monkeypatch, 'sandbox-ok')
    submit = f"/api/seller/orders/{order['id']}/courier-submission"
    response = await client.post(
        submit, json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sandbox-submit-one'},
    )
    assert response.status_code == 200, response.text
    attempt = response.json()['latest_attempt']
    assert attempt['status'] == 'success'
    assert attempt['environment'] == 'sandbox'
    assert attempt['simulated'] is False
    assert attempt['consignment_id'] == CONSIGNMENT
    assert attempt['booking_snapshot']['connection_version'] == 1
    assert attempt['booking_snapshot']['amount_to_collect_bdt'] == 10000

    creates = create_calls(calls)
    assert len(creates) == 1
    payload = json.loads(creates[0].content)
    assert payload == {
        'store_id': 321, 'merchant_order_id': order['id'],
        'recipient_name': 'Parcel Buyer', 'recipient_phone': '01711111111',
        'recipient_address': 'Parcel address, Dhaka',
        'recipient_city': 1, 'recipient_zone': 10, 'recipient_area': 100,
        'delivery_type': 48, 'item_type': 2, 'item_quantity': 3,
        'item_weight': 1.2, 'amount_to_collect': 10000,
    }
    assert 'sandbox-secret' not in response.text and 'sandbox-password' not in response.text

    replay = await client.post(
        submit, json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sandbox-submit-one'},
    )
    assert replay.status_code == 200
    assert replay.json() == response.json()
    assert len(create_calls(calls)) == 1


@pytest.mark.usefixtures('seller_identity')
async def test_sandbox_timeout_stays_unknown_and_verified_consignment_recovers(client, monkeypatch):
    order, path, ready, _ = await sandbox_review(client, monkeypatch, 'sandbox-unknown')

    def timeout():
        raise httpx.ReadTimeout('synthetic sandbox timeout')

    def verified_lookup():
        return httpx.Response(200, json={
            'type': 'success', 'code': 200, 'message': 'Order info',
            'data': {'consignment_id': CONSIGNMENT, 'merchant_order_id': order['id'],
                     'store_id': 321, 'order_status': 'Pending'},
        })

    calls = provider_router(monkeypatch, create=timeout, lookup=verified_lookup)
    submit = f"/api/seller/orders/{order['id']}/courier-submission"
    response = await client.post(
        submit, json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sandbox-timeout'},
    )
    assert response.status_code == 504
    assert response.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'
    current = (await client.get(path)).json()
    assert current['latest_attempt']['status'] == 'unknown'
    assert current['submission_enabled'] is False

    reconcile = await client.post(
        f"/api/seller/orders/{order['id']}/courier-reconciliation",
        json={
            'attempt_id': current['latest_attempt']['id'], 'expected_version': 0,
            'action': 'attach_existing', 'environment': 'sandbox',
            'consignment_id': CONSIGNMENT, 'merchant_order_id': order['id'],
        },
        headers={'Idempotency-Key': 'sandbox-attach'},
    )
    assert reconcile.status_code == 200, reconcile.text
    recovered = reconcile.json()['latest_attempt']
    assert recovered['status'] == 'success'
    assert recovered['consignment_id'] == CONSIGNMENT
    assert recovered['resolution_action'] == 'attach_existing'
    assert len([call for call in calls if call.url.path.endswith('/info')]) == 1


@pytest.mark.usefixtures('seller_identity')
async def test_production_submission_remains_disabled(client, monkeypatch):
    calls = provider_router(monkeypatch)
    await client.post('/api/seller/shop', json={'display_name': 'Production shop'})
    connected = await client.put('/api/seller/courier/pathao/production',
                                 json={'expected_version': 0, 'credentials': CREDENTIALS})
    assert connected.status_code == 200, connected.text
    order = await parcel_order(client, 'production-disabled', parcel_weight_grams=1200, parcel_quantity=1)
    await confirm_automatically(client, order, 'PRODUCTION-DISABLED')
    path = f"/api/seller/orders/{order['id']}/courier-review"
    current = (await client.get(path)).json()
    selected = await client.put(path, json={
        'expected_token': current['token'], 'environment': 'production',
        'store_id': 321, 'delivery_type': 48,
        'location': {'city_id': 1, 'zone_id': 10, 'area_id': 100},
    })
    assert selected.status_code == 200, selected.text
    approved = await client.post(path, json={'expected_token': selected.json()['token']})
    assert approved.status_code == 200, approved.text
    assert approved.json()['submission_enabled'] is False
    response = await client.post(
        f"/api/seller/orders/{order['id']}/courier-submission",
        json={'expected_token': selected.json()['token']},
        headers={'Idempotency-Key': 'production-submit'},
    )
    assert response.status_code == 422
    assert response.json()['error']['code'] == 'REAL_BOOKING_DISABLED'
    assert create_calls(calls) == []

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


@pytest.mark.parametrize('scenario,expected', [
    ('rejected', 'definitive'),
    ('rate_limited', 'definitive'),
    ('server_error', 'ambiguous'),
    ('malformed', 'ambiguous'),
    ('wrong_order', 'ambiguous'),
    ('empty_consignment', 'ambiguous'),
])
async def test_sandbox_transport_classifies_without_replaying(monkeypatch, scenario, expected):
    from app.services import pathao_booking_transport, pathao_provider

    calls: list[httpx.Request] = []

    async def handler(request: httpx.Request):
        calls.append(request)
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60,
                                             'access_token': 'sandbox-access-token'})
        if scenario == 'rejected':
            return httpx.Response(422, json={'error': 'invalid store'})
        if scenario == 'rate_limited':
            return httpx.Response(429, json={'error': 'slow down'})
        if scenario == 'server_error':
            return httpx.Response(500, json={'error': 'unknown'})
        if scenario == 'malformed':
            return httpx.Response(200, json={'unexpected': True})
        data = {'consignment_id': '', 'merchant_order_id': 'order-sandbox-1'} \
            if scenario == 'empty_consignment' else {
                'consignment_id': CONSIGNMENT,
                'merchant_order_id': 'another-order' if scenario == 'wrong_order' else 'order-sandbox-1',
            }
        return httpx.Response(200, json={'data': data})

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(handler))
    with pytest.raises((pathao_provider.CourierDefinitiveFailure, RuntimeError, ValueError)) as caught:
        await pathao_booking_transport.submit('sandbox', booking_snapshot(), sandbox_credentials())
    if expected == 'definitive':
        assert isinstance(caught.value, pathao_provider.CourierDefinitiveFailure)
    else:
        assert not isinstance(caught.value, pathao_provider.CourierDefinitiveFailure)
    assert len(create_calls(calls)) == 1


async def test_sandbox_transport_timeout_and_auth_rejection_are_not_replayed(monkeypatch):
    from app.services import pathao_booking_transport, pathao_provider

    calls: list[httpx.Request] = []

    async def timeout_handler(request: httpx.Request):
        calls.append(request)
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60,
                                             'access_token': 'sandbox-access-token'})
        raise httpx.ReadTimeout('synthetic timeout')

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(timeout_handler))
    with pytest.raises(httpx.TimeoutException):
        await pathao_booking_transport.submit('sandbox', booking_snapshot(), sandbox_credentials())
    assert len(create_calls(calls)) == 1

    calls.clear()

    async def auth_handler(request: httpx.Request):
        calls.append(request)
        return httpx.Response(401, json={'error': 'invalid credentials'})

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(auth_handler))
    with pytest.raises(pathao_provider.CourierDefinitiveFailure):
        await pathao_booking_transport.submit('sandbox', booking_snapshot(), sandbox_credentials())
    assert create_calls(calls) == []


@pytest.mark.parametrize('overrides', [
    {'remaining_cod_minor': 50050, 'amount_to_collect_bdt': 500},
    {'item_weight_grams': 400},
    {'item_weight_grams': 10001},
    {'recipient_phone': '+8801711111111'},
    {'area_id': None},
    {'recipient_address': 'short'},
])
async def test_sandbox_transport_rejects_unsupported_contract_values(monkeypatch, overrides):
    from app.services import pathao_booking_transport, pathao_provider

    async def handler(request: httpx.Request):
        raise AssertionError('No provider request should be sent for invalid local facts.')

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(handler))
    with pytest.raises(pathao_provider.CourierDefinitiveFailure):
        await pathao_booking_transport.submit('sandbox', booking_snapshot(**overrides), sandbox_credentials())


@pytest.mark.parametrize('lookup_response', [
    {'consignment_id': CONSIGNMENT, 'merchant_order_id': 'another-order', 'store_id': 321},
    {'consignment_id': CONSIGNMENT, 'merchant_order_id': 'order-sandbox-1', 'store_id': 999},
    {'consignment_id': 'PT-OTHER-1', 'merchant_order_id': 'order-sandbox-1', 'store_id': 321},
])
async def test_sandbox_lookup_rejects_mismatched_evidence(monkeypatch, lookup_response):
    from app.services import pathao_booking_transport, pathao_provider

    async def handler(request: httpx.Request):
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60,
                                             'access_token': 'sandbox-access-token'})
        return httpx.Response(200, json={'data': lookup_response})

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(handler))
    with pytest.raises(pathao_provider.CourierEvidenceUnavailable):
        await pathao_booking_transport.lookup(
            'sandbox', sandbox_credentials(), CONSIGNMENT, 'order-sandbox-1', 321,
        )


async def test_sandbox_credentials_require_the_reviewed_connection_revision(monkeypatch):
    from app.services import pathao_connections

    calls = provider_router(monkeypatch)
    pathao_connections._memory.clear()
    first = await pathao_connections.connect(None, 'shop-rotation', 'sandbox', pathao_connections.ConnectInput(
        expected_version=0, credentials=sandbox_credentials(),
    ))
    await pathao_connections.connect(None, 'shop-rotation', 'sandbox', pathao_connections.ConnectInput(
        expected_version=first.version, credentials=sandbox_credentials(),
    ))
    with pytest.raises(pathao_connections.CourierSetupError) as caught:
        await pathao_connections.submission_credentials(None, 'shop-rotation', 'sandbox', first.version)
    assert caught.value.status_code == 409
    assert caught.value.code == 'COURIER_SETUP_CHANGED'
    assert create_calls(calls) == []

    with pytest.raises(pathao_connections.CourierSetupError) as missing:
        await pathao_connections.submission_credentials(None, 'shop-rotation', 'sandbox', 99)
    assert missing.value.code == 'COURIER_SETUP_CHANGED'

    with pytest.raises(pathao_connections.CourierSetupError) as absent:
        await pathao_connections.submission_credentials(None, 'shop-missing', 'sandbox', 1)
    assert absent.value.status_code == 422
    assert absent.value.code == 'COURIER_CONNECTION_REQUIRED'
