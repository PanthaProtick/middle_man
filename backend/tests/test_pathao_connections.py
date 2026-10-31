"""Shop-scoped settings through the authenticated HTTP seam."""
import httpx
import pytest
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401

PATH = '/api/seller/courier/pathao/offline'


@pytest.fixture(autouse=True)
def offline_settings(monkeypatch):
    from app.core.config import settings
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    _memory.clear()
    yield
    _memory.clear()


@pytest.mark.usefixtures('seller_identity')
async def test_offline_setup_store_defaults_and_stale_revision(client):
    await client.post('/api/seller/shop', json={'display_name': 'Courier shop'})
    initial = await client.get(PATH)
    assert initial.status_code == 200
    assert initial.json()['status'] == 'disconnected'
    saved = await client.put(PATH, json={'expected_version': 0})
    assert saved.status_code == 200, saved.text
    assert saved.json()['simulated'] is True
    assert saved.json()['production_booking_enabled'] is False
    stores = await client.get(PATH + '/stores', params={'expected_version': 1})
    assert stores.status_code == 200, stores.text
    pickup = stores.json()['stores'][0]['id']
    result = await client.patch(PATH, json={
        'expected_version': 1, 'default_store_id': pickup, 'default_delivery_type': 48,
    })
    assert result.status_code == 200, result.text
    assert result.json()['version'] == 2
    assert result.json()['default_store_id'] == pickup
    assert (await client.get(PATH)).json() == result.json()
    stale = await client.patch(PATH, json={
        'expected_version': 1, 'default_store_id': pickup, 'default_delivery_type': 48,
    })
    assert stale.status_code == 409


CREDENTIALS = {'client_id': 'merchant-client', 'client_secret': 'synthetic-secret',
               'username': 'synthetic@example.test', 'password': 'synthetic-password'}


@pytest.mark.usefixtures('seller_identity')
async def test_sandbox_secret_configuration_redaction_and_provider_contract(client, monkeypatch):
    from cryptography.fernet import Fernet

    from app.core.config import settings

    await client.post('/api/seller/shop', json={'display_name': 'Courier shop'})
    path = PATH.replace('offline', 'sandbox')
    missing = await client.put(path, json={'expected_version': 0, 'credentials': CREDENTIALS})
    assert missing.status_code == 503
    assert missing.json()['error']['code'] == 'PATHAO_KEY_UNAVAILABLE'
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())

    requests = []
    async def provider(request):
        requests.append(request)
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60,
                                            'access_token': 'synthetic-access-token', 'refresh_token': 'unused-refresh'})
        assert request.headers['authorization'] == 'Bearer synthetic-access-token'
        return httpx.Response(200, json={'data': {'data': [
            {'store_id': 321, 'store_name': 'Merchant pickup', 'is_active': 1},
            {'store_id': 322, 'store_name': 'Inactive', 'is_active': 0},
        ], 'current_page': 1, 'last_page': 1}})

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    saved = await client.put(path, json={'expected_version': 0, 'credentials': CREDENTIALS})
    assert saved.status_code == 200, saved.text
    assert len(requests) == 2  # Connection verification only; location lists load on demand.
    assert all(r.url.host == 'courier-api-sandbox.pathao.com' for r in requests)
    assert saved.json()['merchant_hint'] == '••••'
    choices = await client.get(path + '/stores', params={'expected_version': 1})
    assert choices.json()['stores'] == [{'id': 321, 'name': 'Merchant pickup'}]
    for secret in [*CREDENTIALS.values(), 'synthetic-access-token', 'unused-refresh']:
        assert secret not in saved.text + choices.text
    invalid = await client.put(path, json={'expected_version': 1, 'credentials': {**CREDENTIALS, 'password': ''}})
    assert invalid.status_code == 422
    for secret in CREDENTIALS.values():
        assert secret not in invalid.text
    assert (await client.get(PATH)).json()['status'] == 'disconnected'
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    incompatible = await client.get(path)
    assert incompatible.status_code == 503
    assert incompatible.json()['error']['code'] == 'PATHAO_KEY_UNAVAILABLE'


@pytest.mark.usefixtures('seller_identity')
async def test_foreign_store_and_session_cannot_manage_connection(client):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app
    await client.post('/api/seller/shop', json={'display_name': 'First'})
    await client.put(PATH, json={'expected_version': 0})
    stores = (await client.get(PATH + '/stores', params={'expected_version': 1})).json()
    foreign_id = stores['stores'][0]['id']
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('foreign-shop')
    await client.post('/api/seller/shop', json={'display_name': 'Second'})
    assert (await client.get(PATH)).json()['version'] == 0
    await client.put(PATH, json={'expected_version': 0})
    rejected = await client.patch(PATH, json={
        'expected_version': 1, 'default_store_id': foreign_id, 'default_delivery_type': 48})
    assert rejected.status_code == 422
    assert (await client.get(PATH)).json()['version'] == 1
    app.dependency_overrides.pop(get_seller_identity)
    for method, suffix, body in [('GET', '', None), ('PUT', '', {'expected_version': 1}),
                                 ('PATCH', '', {'expected_version': 1, 'default_store_id': 1, 'default_delivery_type': 48}),
                                 ('GET', '/stores?expected_version=1', None)]:
        assert (await client.request(method, PATH + suffix, json=body)).status_code == 401


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('failure', ['invalid', 'timeout', 'empty', 'malformed', 'redirect'])
async def test_provider_failures_do_not_replace_saved_settings(client, monkeypatch, failure, caplog):
    from cryptography.fernet import Fernet

    from app.core.config import settings
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    await client.post('/api/seller/shop', json={'display_name': 'Courier shop'})
    path = PATH.replace('offline', 'sandbox')
    calls = []
    async def provider(request):
        calls.append(request)
        if failure == 'timeout':
            raise httpx.ReadTimeout('synthetic-password synthetic-secret')
        if failure == 'invalid':
            return httpx.Response(401, json={'error': CREDENTIALS})
        if failure == 'redirect':
            return httpx.Response(302, headers={'Location': 'https://unexpected.example/token'})
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60, 'access_token': 'fake'})
        return httpx.Response(200, json={'data': {'data': [], 'current_page': 1, 'last_page': 1}}
                              if failure == 'empty' else {'data': CREDENTIALS})
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    result = await client.put(path, json={'expected_version': 0, 'credentials': CREDENTIALS})
    assert result.status_code == (200 if failure == 'empty' else 422 if failure == 'invalid' else 503)
    assert len(calls) == (2 if failure in ('empty', 'malformed') else 1)
    assert (await client.get(path)).json()['version'] == (1 if failure == 'empty' else 0)
    for secret in CREDENTIALS.values():
        assert secret not in result.text + caplog.text


@pytest.mark.usefixtures('seller_identity')
async def test_replacement_resets_defaults_and_paginated_stores_are_revalidated(client, monkeypatch):
    from cryptography.fernet import Fernet

    from app.core.config import settings
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    await client.post('/api/seller/shop', json={'display_name': 'Courier shop'})
    path = PATH.replace('offline', 'sandbox')
    active = True
    async def provider(request):
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60, 'access_token': 'fake'})
        if request.url.path.endswith('city-list'):
            return httpx.Response(200, json={'data': []})
        page = int(request.url.params['page'])
        return httpx.Response(200, json={'data': {'data': [] if page == 1 else [
            {'store_id': 42, 'store_name': 'Page two pickup', 'is_active': int(active)},
        ], 'current_page': page, 'last_page': 2}})
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    assert (await client.put(path, json={'expected_version': 0, 'credentials': CREDENTIALS})).status_code == 200
    choices = await client.get(path + '/stores', params={'expected_version': 1})
    assert choices.json()['stores'] == [{'id': 42, 'name': 'Page two pickup'}]
    active = False
    payload = {'expected_version': 1, 'default_store_id': 42, 'default_delivery_type': 12}
    assert (await client.patch(path, json=payload)).status_code == 422
    active = True
    assert (await client.patch(path, json=payload)).json()['version'] == 2
    replaced = await client.put(path, json={'expected_version': 2, 'credentials': CREDENTIALS})
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()['version'] == 3
    assert replaced.json()['default_store_id'] is None
    assert replaced.json()['default_delivery_type'] is None
    assert (await client.get(path + '/stores', params={'expected_version': 2})).status_code == 409


@pytest.mark.usefixtures('seller_identity')
async def test_environment_boundaries_dedicated_key_and_offline_credential_rejection(client, monkeypatch):
    from cryptography.fernet import Fernet

    from app.core.config import settings
    await client.post('/api/seller/shop', json={'display_name': 'Courier shop'})
    assert (await client.put(PATH, json={'expected_version': 0, 'credentials': CREDENTIALS})).status_code == 422
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', key)
    monkeypatch.setattr(settings, 'ORDER_LINK_ENCRYPTION_KEY', key)
    sandbox = PATH.replace('offline', 'sandbox')
    assert (await client.put(sandbox, json={'expected_version': 0, 'credentials': CREDENTIALS})).status_code == 503
    monkeypatch.setattr(settings, 'ORDER_LINK_ENCRYPTION_KEY', '')
    hosts = []
    async def provider(request):
        hosts.append(request.url.host)
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60, 'access_token': 'fake'})
        return httpx.Response(200, json={'data': {'data': [{'store_id': 5, 'store_name': 'Pickup', 'is_active': 1}],
                                                'current_page': 1, 'last_page': 1}})
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    production = PATH.replace('offline', 'production')
    assert (await client.put(production, json={'expected_version': 0, 'credentials': CREDENTIALS})).status_code == 200
    assert set(hosts) == {'api-hermes.pathao.com'}
    assert (await client.get(sandbox)).json()['version'] == 0
    assert (await client.get(PATH)).json()['version'] == 0
    assert (await client.get(production)).json()['production_booking_enabled'] is False
    assert (await client.get('/api/public/courier/pathao/production')).status_code == 404


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('oversized_at', ['token', 'stores'])
async def test_oversized_upstream_body_is_closed_before_complete_download(client, monkeypatch, oversized_at):
    from cryptography.fernet import Fernet

    from app.core.config import settings
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    await client.post('/api/seller/shop', json={'display_name': 'Courier shop'})
    consumed = 0
    closed = False
    class OversizedBody(httpx.AsyncByteStream):
        async def __aiter__(self):
            nonlocal consumed
            for _ in range(12):
                consumed += 1
                yield b' ' * 262144

        async def aclose(self):
            nonlocal closed
            closed = True

    async def provider(request):
        if oversized_at == 'stores' and request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'access_token': 'fake', 'expires_in': 60})
        return httpx.Response(200, stream=OversizedBody())
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    response = await client.put(PATH.replace('offline', 'sandbox'),
                                json={'expected_version': 0, 'credentials': CREDENTIALS})
    assert response.status_code == 503
    assert consumed <= 5, 'Stop downloading after the 1 MiB limit, not after the entire 3 MiB body'
    assert closed
