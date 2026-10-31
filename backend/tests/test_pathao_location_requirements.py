"""Available Pathao choices are required; unverifiable catalogs preserve fallback."""
import httpx
import pytest
from buyer_postgres_support import PAYLOAD
from test_pathao_connections import CREDENTIALS
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


def payload(pathao=None):
    address = {**PAYLOAD['address']}
    if pathao is not None:
        address['pathao'] = pathao
    return {**PAYLOAD, 'address': address}


async def connect(client):
    result = await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})
    assert result.status_code == 200, result.text


def history_item(client, order):
    return client.get(f"/api/seller/orders/{order['id']}/history")


@pytest.mark.parametrize('pathao,field', [
    ({}, 'address.pathao.city_id'),
    ({'city_id': 1}, 'address.pathao.zone_id'),
    ({'city_id': 1, 'zone_id': 10}, 'address.pathao.area_id'),
])
@pytest.mark.usefixtures('seller_identity')
async def test_available_choices_are_required_before_acceptance(client, pathao, field):
    order = await _create_test_order(client)
    await connect(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    rejected = await client.post(path, json=payload(pathao), headers={'Idempotency-Key': 'missing'})
    assert rejected.status_code == 422
    error = rejected.json()['error']
    assert error['code'] == 'PATHAO_LOCATION_REQUIRED'
    assert len(error['fields']) == 1
    field_error = error['fields'][0]
    assert field_error['field'] == field
    assert field_error['code'] == 'pathao_location_required'
    assert field_error['message']
    assert (await client.get(f"/api/public/orders/{order['portal_token']}")).json()['lifecycle'] == 'awaiting_buyer'
    assert (await history_item(client, order)).json()['items'] == []

    accepted = await client.post(path, json=payload({'city_id': 1, 'zone_id': 10, 'area_id': 100}),
                                 headers={'Idempotency-Key': 'complete'})
    assert accepted.status_code == 200, accepted.text
    assert (await history_item(client, order)).json()['items'][0]['address']['pathao']['condition'] == 'resolved'


@pytest.mark.usefixtures('seller_identity')
async def test_explicit_unsupported_state_preserves_claim(client):
    order = await _create_test_order(client)
    await connect(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    explicit = await client.post(path, json=payload({'unsupported': True}), headers={'Idempotency-Key': 'explicit'})
    assert explicit.status_code == 200, explicit.text
    item = (await history_item(client, order)).json()['items'][0]
    location = item['address']['pathao']
    assert location['condition'] == 'unsupported'
    assert location['city_id'] is None and location['booking_blocked'] is True
    assert item['payment_claim']['trx_id'] == PAYLOAD['payment_claim']['trx_id']


@pytest.mark.usefixtures('seller_identity')
async def test_no_area_zone_is_seller_resolution_not_a_missing_choice(client):
    order = await _create_test_order(client)
    await connect(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    no_area = await client.post(path, json=payload({'city_id': 1, 'zone_id': 11}),
                                headers={'Idempotency-Key': 'no-area'})
    assert no_area.status_code == 200, no_area.text
    location = (await history_item(client, order)).json()['items'][0]['address']['pathao']
    assert location['condition'] == 'no_area_unverified'
    assert location['city_id'] == 1 and location['zone_id'] == 11
    assert location['area_id'] is None and location['booking_blocked'] is True


@pytest.mark.usefixtures('seller_identity')
async def test_explicit_coverage_problem_cannot_authorize_booking(client):
    order = await _create_test_order(client)
    await connect(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    flagged = await client.post(path, json=payload({
        'city_id': 1, 'zone_id': 10, 'area_id': 100, 'unsupported': True}),
        headers={'Idempotency-Key': 'flagged'})
    assert flagged.status_code == 200, flagged.text
    location = (await history_item(client, order)).json()['items'][0]['address']['pathao']
    assert location['condition'] == 'unsupported'
    assert location['city_id'] == 1 and location['area_id'] == 100
    assert location['booking_blocked'] is True


@pytest.mark.parametrize('unsupported', [False, True])
@pytest.mark.parametrize('pathao,field', [
    ({'city_id': 999}, 'city_id'),
    ({'city_id': 1, 'zone_id': 999}, 'zone_id'),
    ({'city_id': 1, 'zone_id': 10, 'area_id': 999}, 'area_id'),
])
@pytest.mark.usefixtures('seller_identity')
async def test_known_invalid_hierarchy_is_rejected_regardless_of_claims(client, pathao, field, unsupported):
    order = await _create_test_order(client)
    await connect(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    result = await client.post(path, json=payload({**pathao, 'unsupported': unsupported}), headers={'Idempotency-Key': 'forged'})
    assert result.status_code == 422
    assert result.json()['error']['code'] == 'PATHAO_LOCATION_INVALID'
    assert result.json()['error']['fields'][0]['field'] == f'address.pathao.{field}'


@pytest.mark.usefixtures('seller_identity')
async def test_zone_from_another_city_is_rejected(client, monkeypatch):
    from app.models.pathao_location import LocationChoice
    from app.services import pathao_catalog

    def two_city_catalog(level, parent):
        if level == 'city':
            return [LocationChoice(id=1, name='One'), LocationChoice(id=2, name='Two')]
        if level == 'zone':
            return [LocationChoice(id=10, name='First zone')] if parent == 1 else [LocationChoice(id=20, name='Second zone')]
        return [LocationChoice(id=100, name='Area', home_delivery_available=True)]

    monkeypatch.setattr(pathao_catalog, 'simulated', two_city_catalog)
    order = await _create_test_order(client)
    await connect(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    result = await client.post(path, json=payload({'city_id': 2, 'zone_id': 10, 'area_id': 100}),
                               headers={'Idempotency-Key': 'cross-parent'})
    assert result.status_code == 422
    assert result.json()['error']['code'] == 'PATHAO_LOCATION_INVALID'


@pytest.mark.usefixtures('seller_identity')
async def test_client_supplied_resolution_claims_are_ignored(client):
    order = await _create_test_order(client)
    await connect(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    result = await client.post(path, json=payload({
        'city_id': 1, 'zone_id': 10, 'area_id': 100, 'condition': 'resolved',
        'booking_blocked': False, 'city_name': 'Forged label',
    }), headers={'Idempotency-Key': 'forged-label'})
    assert result.status_code == 200, result.text
    location = (await history_item(client, order)).json()['items'][0]['address']['pathao']
    assert location['city_name'] == 'Simulated Dhaka'
    assert location['condition'] == 'resolved'
    assert location['booking_blocked'] is True


@pytest.fixture
def sandbox_provider(monkeypatch):
    from cryptography.fernet import Fernet

    from app.core.config import settings
    calls = []
    catalogs = {'city': [{'city_id': 5, 'city_name': 'Dhaka'}],
                'zone': [{'zone_id': 6, 'zone_name': 'Zone'}],
                'area': [{'area_id': 7, 'area_name': 'Area', 'home_delivery_available': True}]}

    async def provider(request):
        calls.append(request.url.path)
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60, 'access_token': 'token'})
        if request.url.path.endswith('/stores'):
            return httpx.Response(200, json={'data': {'data': [], 'current_page': 1, 'last_page': 1}})
        if request.url.path.endswith('city-list'):
            return httpx.Response(200, json={'data': {'data': catalogs['city']}})
        if request.url.path.endswith('zone-list'):
            return httpx.Response(200, json={'data': catalogs['zone']})
        if request.url.path.endswith('area-list'):
            return httpx.Response(200, json={'data': catalogs['area']})
        return httpx.Response(200, json={'data': []})

    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'sandbox')
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    return calls, catalogs


async def connect_sandbox(client):
    result = await client.put('/api/seller/courier/pathao/sandbox',
                              json={'expected_version': 0, 'credentials': CREDENTIALS})
    assert result.status_code == 200, result.text


@pytest.mark.parametrize('empty_level,selection,condition', [
    ('city', {}, 'missing_choices'),
    ('zone', {'city_id': 5}, 'missing_choices'),
    ('area', {'city_id': 5, 'zone_id': 6, 'area_id': 7}, 'no_area_unverified'),
])
@pytest.mark.usefixtures('seller_identity')
async def test_empty_catalogs_preserve_fallback_without_fabricated_ids(
        client, sandbox_provider, empty_level, selection, condition):
    calls, catalogs = sandbox_provider
    order = await _create_test_order(client)
    catalogs[empty_level] = []
    await connect_sandbox(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    result = await client.post(path, json=payload(selection), headers={'Idempotency-Key': 'empty'})
    assert result.status_code == 200, result.text
    location = (await history_item(client, order)).json()['items'][0]['address']['pathao']
    assert location['condition'] == condition
    assert location['booking_blocked'] is True
    if empty_level == 'city':
        assert location['city_id'] is None
    elif empty_level == 'zone':
        assert location['city_id'] == 5 and location['zone_id'] is None
    else:
        assert location['city_id'] == 5 and location['zone_id'] == 6
        assert location['area_id'] is None
    assert calls


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('selection', [{}, {'city_id': 999}, {'city_id': 1, 'zone_id': 10, 'area_id': 100}])
async def test_changed_catalog_authority_discards_unverified_selection(client, monkeypatch, selection):
    from app.services import pathao_locations
    from app.services.pathao_connections import Revision, _memory
    order = await _create_test_order(client)
    await connect(client)
    original = pathao_locations.resolve_choices

    async def replace_revision(*args, **kwargs):
        try:
            return await original(*args, **kwargs)
        finally:
            shop, environment = args[0], args[1]
            _memory[(shop, environment)] = [Revision(2)]

    monkeypatch.setattr(pathao_locations, 'resolve_choices', replace_revision)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    result = await client.post(path, json=payload(selection),
                               headers={'Idempotency-Key': 'changed'})
    assert result.status_code == 200, result.text
    location = (await history_item(client, order)).json()['items'][0]['address']['pathao']
    assert location['condition'] == 'unavailable'
    assert location['city_id'] is None
    assert location['booking_blocked'] is True


@pytest.mark.usefixtures('seller_identity')
async def test_accepted_replay_does_not_need_fresh_catalog_work(client, sandbox_provider):
    from app.services.pathao_catalog import clear_cache
    from app.services.pathao_connections import _memory
    calls, _ = sandbox_provider
    order = await _create_test_order(client)
    await connect_sandbox(client)
    path = f"/api/public/orders/{order['portal_token']}/submission"
    sent = payload({'city_id': 5, 'zone_id': 6, 'area_id': 7})
    first = await client.post(path, json=sent, headers={'Idempotency-Key': 'replay'})
    assert first.status_code == 200, first.text
    assert calls
    _memory.clear()
    clear_cache()
    calls.clear()
    replay = await client.post(path, json=sent, headers={'Idempotency-Key': 'replay'})
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert calls == []
