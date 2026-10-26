"""The management API persists immutable revisions and serializes competing writers."""
import asyncio

import httpx
import pytest
from cryptography.fernet import Fernet

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.config import settings
from app.main import app

PATH = '/api/seller/courier/pathao/offline'


@pytest.fixture(autouse=True)
def offline_config(monkeypatch):
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)


async def test_settings_restart_stale_writers_and_shop_environment_isolation(postgres_buyer):
    client, connection, _, order = postgres_buyer
    saved = await client.put(PATH, json={'expected_version': 0})
    assert saved.status_code == 200, saved.text
    choices = (await client.get(PATH + '/stores', params={'expected_version': 1})).json()
    pickup = choices['stores'][0]['id']
    payload = {'expected_version': 1, 'default_store_id': pickup, 'default_delivery_type': 48}
    first, second = await asyncio.gather(client.patch(PATH, json=payload), client.patch(PATH, json=payload))
    assert sorted([first.status_code, second.status_code]) == [200, 409]
    from app.services.pathao_connections import _memory
    _memory.clear()
    read = await client.get(PATH)
    assert read.json()['version'] == 2
    assert read.json()['default_store_id'] == pickup
    # Security-specific persistence assertion: earlier revisions remain independently addressable.
    assert await connection.fetchval('SELECT count(*) FROM pathao_connection_revisions WHERE shop_id=$1', order['shop_id']) == 2
    assert await connection.fetchval('SELECT default_store_id FROM pathao_connection_revisions WHERE shop_id=$1 AND version=1', order['shop_id']) is None
    assert (await client.get(PATH.replace('offline', 'sandbox'))).json()['version'] == 0
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('another-merchant')
    await client.post('/api/seller/shop', json={'display_name': 'Other merchant'})
    assert (await client.get(PATH)).json()['version'] == 0
    await client.put(PATH, json={'expected_version': 0})
    assert (await client.patch(PATH, json=payload)).status_code == 422
    assert (await client.get(PATH)).json()['version'] == 1


async def test_encrypted_credentials_survive_restart_and_never_enter_responses(postgres_buyer, monkeypatch):
    client, connection, _, order = postgres_buyer
    path = PATH.replace('offline', 'sandbox')
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    credentials = {'client_id': 'synthetic-client-id', 'client_secret': 'synthetic-secret',
                   'username': 'synthetic@example.test', 'password': 'synthetic-password'}
    async def provider(request):
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'access_token': 'synthetic-token', 'expires_in': 60})
        return httpx.Response(200, json={'data': {'data': [{'store_id': 10, 'store_name': 'Pickup', 'is_active': 1}],
                                                'current_page': 1, 'last_page': 1}})
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    result = await client.put(path, json={'expected_version': 0, 'credentials': credentials})
    assert result.status_code == 200, result.text
    ciphertext = await connection.fetchval('SELECT encrypted_credentials FROM pathao_connection_revisions WHERE shop_id=$1', order['shop_id'])
    for secret in [*credentials.values(), 'synthetic-token']:
        assert secret not in ciphertext + result.text
    from app.services.pathao_connections import _memory
    _memory.clear()
    choices = await client.get(path + '/stores', params={'expected_version': 1})
    assert choices.json()['stores'] == [{'id': 10, 'name': 'Pickup'}]
    saved = await client.patch(path, json={'expected_version': 1, 'default_store_id': 10, 'default_delivery_type': 48})
    assert saved.status_code == 200, saved.text
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', '')
    assert (await client.get(path)).status_code == 503


async def test_replacement_during_store_lookup_rejects_old_defaults_without_holding_db_locks(postgres_buyer, monkeypatch):
    client, _, _, _ = postgres_buyer
    path = PATH.replace('offline', 'sandbox')
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    credentials = {'client_id': 'synthetic-id', 'client_secret': 'synthetic-secret',
                   'username': 'synthetic@example.test', 'password': 'synthetic-password'}
    started, release = asyncio.Event(), asyncio.Event()
    delay_next = False
    async def provider(request):
        nonlocal delay_next
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'access_token': 'fake', 'expires_in': 60})
        if delay_next:
            delay_next = False
            started.set()
            await release.wait()
        return httpx.Response(200, json={'data': {'data': [{'store_id': 10, 'store_name': 'Pickup', 'is_active': 1}],
                                                'current_page': 1, 'last_page': 1}})
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    assert (await client.put(path, json={'expected_version': 0, 'credentials': credentials})).status_code == 200
    delay_next = True
    pending = asyncio.create_task(client.patch(path, json={
        'expected_version': 1, 'default_store_id': 10, 'default_delivery_type': 48}))
    try:
        await asyncio.wait_for(started.wait(), 5)
        replaced = await asyncio.wait_for(client.put(path, json={'expected_version': 1, 'credentials': credentials}), 5)
        assert replaced.status_code == 200, replaced.text
    finally:
        release.set()
    assert (await pending).status_code == 409
    current = (await client.get(path)).json()
    assert current['version'] == 2 and current['default_store_id'] is None
