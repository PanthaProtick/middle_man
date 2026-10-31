"""Buyer-link catalog and submitted destination behavior through HTTP."""
import pytest
from buyer_postgres_support import PAYLOAD
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401


@pytest.fixture(autouse=True)
def locations(monkeypatch):
    from app.core.config import settings
    from app.services.pathao_catalog import clear_cache
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    _memory.clear()
    clear_cache()
    yield
    _memory.clear()


@pytest.mark.usefixtures('seller_identity')
async def test_disconnected_address_and_payment_survive_with_explicit_resolution(client):
    order = await _create_test_order(client)
    path = f"/api/public/orders/{order['portal_token']}"
    catalog = await client.get(path + '/pathao-locations')
    assert catalog.status_code == 200
    assert catalog.json()['condition'] == 'disconnected'
    response = await client.post(path + '/submission', json=PAYLOAD, headers={'Idempotency-Key': 'fallback'})
    assert response.status_code == 200, response.text
    history = await client.get(f"/api/seller/orders/{order['id']}/history")
    item = history.json()['items'][0]
    assert item['address']['pathao']['condition'] == 'disconnected'
    assert item['address']['raw_text'] == PAYLOAD['address']['raw_text']
    assert item['payment_claim']['trx_id'] == PAYLOAD['payment_claim']['trx_id']
    assert item['contact_number'] != item['payment_claim']['sender_number']
    assert 'pathao' not in response.text


@pytest.mark.usefixtures('seller_identity')
async def test_dependent_membership_labels_coverage_and_no_area(client):
    order = await _create_test_order(client)
    await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})
    path = f"/api/public/orders/{order['portal_token']}"
    cities = (await client.get(path + '/pathao-locations')).json()
    assert cities['simulated'] is True
    assert cities['choices'][0] == {'id': 1, 'name': 'Simulated Dhaka', 'home_delivery_available': None}
    zones = (await client.get(path + '/pathao-locations?city_id=1')).json()['choices']
    assert [z['id'] for z in zones] == [10, 11]
    payload = {**PAYLOAD, 'address': {**PAYLOAD['address'], 'pathao': {'city_id': 1, 'zone_id': 999}}}
    bad = await client.post(path + '/submission', json=payload, headers={'Idempotency-Key': 'invalid'})
    assert bad.status_code == 422
    assert bad.json()['error']['code'] == 'PATHAO_LOCATION_INVALID'
    payload['address']['pathao'] = {'city_id': 1, 'zone_id': 10, 'area_id': 100, 'city_name': 'forged'}
    saved = await client.post(path + '/submission', json=payload, headers={'Idempotency-Key': 'valid'})
    assert saved.status_code == 200, saved.text
    replay = await client.post(path + '/submission', json=payload, headers={'Idempotency-Key': 'valid'})
    assert replay.json() == saved.json()
    history = (await client.get(f"/api/seller/orders/{order['id']}/history")).json()['items'][0]
    location = history['address']['pathao']
    assert location['city_name'] == 'Simulated Dhaka'
    assert location['condition'] == 'resolved'
    assert location['booking_blocked'] is True  # Offline data never authorizes booking.


@pytest.mark.parametrize('zone,area,condition', [(10, 101, 'unsupported'), (11, None, 'no_area_unverified')])
@pytest.mark.usefixtures('seller_identity')
async def test_unresolved_destinations_preserve_payment(client, zone, area, condition):
    order = await _create_test_order(client)
    await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})
    path = f"/api/public/orders/{order['portal_token']}"
    payload = {**PAYLOAD, 'address': {**PAYLOAD['address'], 'pathao': {'city_id': 1, 'zone_id': zone, 'area_id': area}}}
    saved = await client.post(path + '/submission', json=payload, headers={'Idempotency-Key': 'unresolved'})
    assert saved.status_code == 200, saved.text
    item = (await client.get(f"/api/seller/orders/{order['id']}/history")).json()['items'][0]
    assert item['address']['pathao']['condition'] == condition
    assert item['address']['pathao']['booking_blocked'] is True
    assert item['payment_claim']['amount_minor'] == PAYLOAD['payment_claim']['amount_minor']


@pytest.mark.usefixtures('seller_identity')
async def test_cached_catalog_outage_fallback_and_untrusted_ids(client, monkeypatch):
    import httpx
    from cryptography.fernet import Fernet
    from test_pathao_connections import CREDENTIALS

    from app.core.config import settings
    from app.services import pathao_catalog
    clock = 1000.0
    monkeypatch.setattr(pathao_catalog, 'monotonic', lambda: clock)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'sandbox')
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    outage = False
    catalog_requests = []
    async def provider(request):
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60, 'access_token': 'private-token'})
        if request.url.path.endswith('/stores'):
            return httpx.Response(200, json={'data': {'data': [], 'current_page': 1, 'last_page': 1}})
        catalog_requests.append(request.url.path)
        if outage:
            return httpx.Response(503, text='private merchant diagnostic')
        if request.url.path.endswith('city-list'):
            return httpx.Response(200, json={'data': {'data': [{'city_id': 5, 'city_name': 'Dhaka'}]}})
        if request.url.path.endswith('zone-list'):
            return httpx.Response(200, json={'data': [{'zone_id': 6, 'zone_name': 'Zone'}]})
        return httpx.Response(200, json={'data': [{'area_id': 7, 'area_name': 'Area', 'home_delivery_available': True}]})
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    order = await _create_test_order(client)
    assert (await client.put('/api/seller/courier/pathao/sandbox', json={'expected_version': 0, 'credentials': CREDENTIALS})).status_code == 200
    path = f"/api/public/orders/{order['portal_token']}"
    first = await client.get(path + '/pathao-locations?city_id=5&zone_id=6')
    assert first.status_code == 200, first.text
    assert first.json()['choices'][0]['id'] == 7
    assert first.headers['cache-control'] == 'no-store, private'
    outage = True
    assert (await client.get(path + '/pathao-locations?city_id=5&zone_id=6')).json() == first.json()
    assert len(catalog_requests) == 3
    clock += 301  # Buyer snapshots survive the former provider-cache TTL.
    cached = await client.get(path + '/pathao-locations')
    assert cached.json()['condition'] == 'resolved'
    assert 'private' not in cached.text
    payload = {**PAYLOAD, 'address': {**PAYLOAD['address'], 'pathao': {
        'city_id': 999, 'zone_id': 998, 'area_id': 997, 'condition': 'resolved', 'booking_blocked': False}}}
    invalid = await client.post(path + '/submission', json=payload, headers={'Idempotency-Key': 'forged'})
    assert invalid.status_code == 422  # An outage never bypasses saved membership checks.
    payload['address']['pathao'] = {'city_id': 5, 'zone_id': 6, 'area_id': 7}
    saved = await client.post(path + '/submission', json=payload, headers={'Idempotency-Key': 'saved-snapshot'})
    assert saved.status_code == 200, saved.text
    item = (await client.get(f"/api/seller/orders/{order['id']}/history")).json()['items'][0]
    assert item['address']['pathao']['condition'] == 'resolved'
    assert item['address']['pathao']['city_id'] == 5
    assert item['address']['pathao']['booking_blocked'] is True
    assert item['payment_claim']['trx_id'] == PAYLOAD['payment_claim']['trx_id']
    assert len(catalog_requests) == 3



@pytest.mark.usefixtures('seller_identity')
async def test_catalog_link_lifecycle_privacy_and_public_gate(client):
    from app.core.public_gate import verify_public_access_gate
    from app.main import app
    order = await _create_test_order(client)
    path = f"/api/public/orders/{order['portal_token']}"
    assert (await client.get('/api/public/orders/invalid/pathao-locations')).status_code == 404
    app.dependency_overrides.pop(verify_public_access_gate)
    assert (await client.get(path + '/pathao-locations')).status_code == 503
    from app.core.public_gate import allow_synthetic_buyer_demo
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    revoked = await client.post(f"/api/seller/orders/{order['id']}/revoke-link",
                               json={'expected_version': order['version']}, headers={'Idempotency-Key': 'revoke'})
    assert revoked.status_code == 200, revoked.text
    assert (await client.get(path + '/pathao-locations')).status_code == 410


@pytest.mark.usefixtures('seller_identity')
async def test_expired_catalog_and_inconsistent_query_are_denied(client):
    import datetime

    from app.api.public_orders import get_buyer_clock
    from app.main import app
    order = await _create_test_order(client)
    path = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    assert (await client.get(path + '?zone_id=10')).status_code == 422
    expiry = datetime.datetime.fromisoformat(order['expires_at'])
    app.dependency_overrides[get_buyer_clock] = lambda: lambda: expiry
    assert (await client.get(path)).status_code == 410


@pytest.mark.parametrize('state,expected', [('expired', 410), ('submitted', 409)])
@pytest.mark.usefixtures('seller_identity')
async def test_closed_submission_window_does_not_contact_catalog(client, monkeypatch, state, expected):
    import datetime

    import httpx
    from cryptography.fernet import Fernet
    from test_pathao_connections import CREDENTIALS

    from app.api.public_orders import get_buyer_clock
    from app.core.config import settings
    from app.main import app
    from app.services.pathao_catalog import clear_cache
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'sandbox')
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    requests = []
    async def provider(request):
        requests.append(request.url.path)
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60, 'access_token': 'synthetic'})
        if request.url.path.endswith('/stores'):
            return httpx.Response(200, json={'data': {'data': [], 'current_page': 1, 'last_page': 1}})
        return httpx.Response(200, json={'data': []})
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    order = await _create_test_order(client)
    await client.put('/api/seller/courier/pathao/sandbox', json={'expected_version': 0, 'credentials': CREDENTIALS})
    public = f"/api/public/orders/{order['portal_token']}/submission"
    if state == 'submitted':
        assert (await client.post(public, json=PAYLOAD, headers={'Idempotency-Key': 'first'})).status_code == 200
    else:
        expiry = datetime.datetime.fromisoformat(order['expires_at'])
        app.dependency_overrides[get_buyer_clock] = lambda: lambda: expiry
    clear_cache()
    requests.clear()
    result = await client.post(public, json=PAYLOAD, headers={'Idempotency-Key': 'fresh-key'})
    assert result.status_code == expected, result.text
    assert requests == []


@pytest.mark.usefixtures('seller_identity')
async def test_corrections_preserve_location_until_address_changes(client):
    order = await _create_test_order(client)
    await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})
    payload = {**PAYLOAD, 'address': {**PAYLOAD['address'], 'pathao': {'city_id': 1, 'zone_id': 10, 'area_id': 100}}}
    submitted = await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=payload,
                                  headers={'Idempotency-Key': 'initial'})
    assert submitted.status_code == 200
    path = f"/api/seller/orders/{order['id']}"
    for key, changes in [('name', {'buyer_name': 'Corrected name'}),
                          ('payment', {'payment_claim': {**PAYLOAD['payment_claim'], 'trx_id': 'CORRECTED'}}),
                          ('address', {'address': {'raw_text': 'Different delivery address', 'pathao': {
                              'city_id': 1, 'zone_id': 10, 'area_id': 100, 'condition': 'resolved', 'booking_blocked': False}}})]:
        version = (await client.get(path)).json()['version']
        result = await client.patch(path + '/buyer-details', json={'expected_version': version, 'reason': 'Synthetic correction', **changes},
                                    headers={'Idempotency-Key': key})
        assert result.status_code == 200, result.text
        location = (await client.get(path + '/history')).json()['items'][-1]['address']['pathao']
        assert location['condition'] == ('missing_choices' if key == 'address' else 'resolved')
        assert location['booking_blocked'] is True
        assert location['city_id'] == (None if key == 'address' else 1)
