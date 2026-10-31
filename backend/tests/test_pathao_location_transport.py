"""Buyer location resilience at the controlled provider transport boundary."""
import asyncio

import httpx
import pytest
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401

from app.services.pathao_connections import Revision


def _token(expires_in: int = 3600) -> httpx.Response:
    return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': expires_in,
                                     'access_token': 'synthetic-token'})


def _cities(rows=None) -> httpx.Response:
    return httpx.Response(200, json={'data': {'data': rows or [{'city_id': 5, 'city_name': 'Dhaka'}]}})


def _zones(rows=None) -> httpx.Response:
    return httpx.Response(200, json={'data': {'data': rows or [{'zone_id': 6, 'zone_name': 'Zone'}]}})


def _rate_limited(retry_after: str | None) -> httpx.Response:
    headers = {'Retry-After': retry_after} if retry_after is not None else {}
    return httpx.Response(429, headers=headers)


def _connect(order: dict) -> None:
    from app.services.pathao_connections import _memory
    _memory[(order['shop_id'], 'sandbox')] = [Revision(1, encrypted_credentials='sealed')]


@pytest.fixture(autouse=True)
def sandbox_provider(monkeypatch):
    from cryptography.fernet import Fernet

    from app.core.config import settings
    from app.models.pathao import MerchantCredentials
    from app.services import pathao_catalog, pathao_location_access
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'sandbox')
    monkeypatch.setattr(settings, 'PATHAO_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    credentials = MerchantCredentials(client_id='id', client_secret='secret',
                                      username='user', password='pass')
    monkeypatch.setattr(pathao_location_access, 'unseal', lambda _: credentials)
    _memory.clear()
    pathao_catalog.clear_cache()
    yield
    _memory.clear()
    pathao_catalog.clear_cache()


@pytest.fixture
def clock(monkeypatch):
    from app.services import pathao_catalog
    value = [1000.0]
    monkeypatch.setattr(pathao_catalog, 'monotonic', lambda: value[0])
    return value


@pytest.mark.usefixtures('seller_identity')
async def test_concurrent_identical_reads_share_token_and_list_work(client, clock, monkeypatch):
    order = await _create_test_order(client)
    _connect(order)
    calls = {'auth': 0, 'list': 0}
    entered = asyncio.Event()
    release = asyncio.Event()

    async def provider(request):
        if request.url.path.endswith('issue-token'):
            calls['auth'] += 1
            return _token()
        calls['list'] += 1
        entered.set()
        await release.wait()
        return _zones() if request.url.path.endswith('zone-list') else _cities()

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    path = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    tasks = [asyncio.create_task(client.get(path)) for _ in range(4)]
    await asyncio.wait_for(entered.wait(), 2)
    for _ in range(10):
        await asyncio.sleep(0)
    release.set()
    responses = await asyncio.gather(*tasks)
    assert all(response.status_code == 200 for response in responses)
    assert all(response.json()['condition'] == 'resolved' for response in responses)
    assert calls == {'auth': 1, 'list': 1}

    zones = await client.get(path, params={'city_id': 5})
    assert zones.status_code == 200 and zones.json()['choices'][0]['id'] == 6
    assert calls == {'auth': 1, 'list': 2}


@pytest.mark.usefixtures('seller_identity')
async def test_token_and_list_expiry_reuse_until_each_bound(client, clock, monkeypatch):
    order = await _create_test_order(client)
    _connect(order)
    calls = {'auth': 0, 'list': 0}

    async def provider(request):
        if request.url.path.endswith('issue-token'):
            calls['auth'] += 1
            return _token(expires_in=3600)
        calls['list'] += 1
        return _cities()

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    path = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    assert (await client.get(path)).status_code == 200
    assert calls == {'auth': 1, 'list': 1}
    clock[0] += 120
    assert (await client.get(path)).json()['condition'] == 'resolved'
    assert calls == {'auth': 1, 'list': 1}
    clock[0] += 200  # The five-minute list cache has expired; the token has not.
    assert (await client.get(path)).status_code == 200
    assert calls == {'auth': 1, 'list': 2}
    clock[0] += 4000  # Both the list cache and the 90%-of-expiry token are stale.
    assert (await client.get(path)).status_code == 200
    assert calls == {'auth': 2, 'list': 3}


@pytest.mark.usefixtures('seller_identity')
async def test_concurrent_authentication_rate_limit_issues_one_token_attempt(client, clock, monkeypatch):
    order = await _create_test_order(client)
    _connect(order)
    auth_calls = 0

    async def provider(request):
        nonlocal auth_calls
        if request.url.path.endswith('issue-token'):
            auth_calls += 1
            return _rate_limited(None)
        return _cities()

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    path = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    responses = await asyncio.gather(*(client.get(path) for _ in range(6)))
    assert all(response.json()['condition'] == 'unavailable' for response in responses)
    assert auth_calls == 1


@pytest.mark.parametrize('retry_after,delay', [(None, 5.0), ('invalid', 5.0), ('0', 5.0), ('20', 20.0)])
@pytest.mark.usefixtures('seller_identity')
async def test_authentication_rate_limit_guidance_and_bounded_backoff(client, clock, monkeypatch, retry_after, delay):
    order = await _create_test_order(client)
    _connect(order)
    calls = {'auth': 0, 'list': 0}

    async def provider(request):
        if request.url.path.endswith('issue-token'):
            calls['auth'] += 1
            return _rate_limited(retry_after) if calls['auth'] == 1 else _token()
        calls['list'] += 1
        return _cities()

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    path = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    first = await client.get(path)
    assert first.json()['condition'] == 'unavailable' and first.json()['choices'] == []
    assert calls == {'auth': 1, 'list': 0}
    clock[0] += delay - 1
    assert (await client.get(path)).json()['condition'] == 'unavailable'
    assert calls == {'auth': 1, 'list': 0}
    clock[0] += 2
    assert (await client.get(path)).json()['condition'] == 'resolved'
    assert calls == {'auth': 2, 'list': 1}


@pytest.mark.parametrize('retry_after,delay', [(None, 5.0), ('0', 5.0), ('15', 15.0)])
@pytest.mark.usefixtures('seller_identity')
async def test_location_rate_limit_keeps_the_token_and_recovers_after_cooldown(client, clock, monkeypatch, retry_after, delay):
    order = await _create_test_order(client)
    _connect(order)
    calls = {'auth': 0, 'list': 0}

    async def provider(request):
        if request.url.path.endswith('issue-token'):
            calls['auth'] += 1
            return _token()
        calls['list'] += 1
        return _rate_limited(retry_after) if calls['list'] == 1 else _cities()

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    path = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    assert (await client.get(path)).json()['condition'] == 'unavailable'
    assert calls == {'auth': 1, 'list': 1}
    clock[0] += delay - 1
    assert (await client.get(path)).json()['condition'] == 'unavailable'
    assert calls == {'auth': 1, 'list': 1}
    clock[0] += 2
    assert (await client.get(path)).json()['condition'] == 'resolved'
    assert calls == {'auth': 1, 'list': 2}


@pytest.mark.parametrize('failure', ['timeout', 'invalid-json', 'wrong-shape', 'missing-name', 'duplicate'])
@pytest.mark.usefixtures('seller_identity')
async def test_provider_failures_are_not_cached_as_empty_lists_and_recover(client, clock, monkeypatch, failure):
    order = await _create_test_order(client)
    _connect(order)
    calls = {'auth': 0, 'list': 0}

    async def provider(request):
        if request.url.path.endswith('issue-token'):
            calls['auth'] += 1
            return _token()
        calls['list'] += 1
        if calls['list'] > 1:
            return _cities()
        if failure == 'timeout':
            raise httpx.ReadTimeout('synthetic provider timeout')
        if failure == 'invalid-json':
            return httpx.Response(200, content=b'{')
        if failure == 'wrong-shape':
            return httpx.Response(200, json={'data': {'data': 'not-a-list'}})
        if failure == 'missing-name':
            return _cities([{'city_id': 5}])
        return _cities([{'city_id': 5, 'city_name': 'Dhaka'},
                        {'city_id': 5, 'city_name': 'Duplicate'}])

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    path = f"/api/public/orders/{order['portal_token']}/pathao-locations"
    failed = await client.get(path)
    assert failed.status_code == 200
    assert failed.json()['condition'] == 'unavailable' and failed.json()['choices'] == []
    recovered = await client.get(path)
    assert recovered.json()['condition'] == 'resolved'
    assert recovered.json()['choices'][0]['id'] == 5
    assert calls == {'auth': 1, 'list': 2}
