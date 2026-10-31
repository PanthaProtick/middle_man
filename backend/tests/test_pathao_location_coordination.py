"""Process-local location coordination: cleanup, isolation and bounded storage."""
import asyncio

import httpx
import pytest

from app.models.pathao import MerchantCredentials
from app.services import pathao_catalog
from app.services import pathao_location_access as access
from app.services.pathao_connections import Revision
from app.services.seller_service import SellerDomainException


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    credentials = MerchantCredentials(client_id='id', client_secret='secret',
                                      username='user', password='pass')
    monkeypatch.setattr(access, 'unseal', lambda _: credentials)
    pathao_catalog.clear_cache()
    yield
    pathao_catalog.clear_cache()


@pytest.fixture
def clock(monkeypatch):
    value = [1000.0]
    monkeypatch.setattr(pathao_catalog, 'monotonic', lambda: value[0])
    return value


def _token() -> httpx.Response:
    return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 3600,
                                     'access_token': 'synthetic-token'})


def _cities() -> httpx.Response:
    return httpx.Response(200, json={'data': [{'city_id': 5, 'city_name': 'Dhaka'}]})


def _zones() -> httpx.Response:
    return httpx.Response(200, json={'data': [{'zone_id': 6, 'zone_name': 'Zone'}]})


async def test_cancelled_waiter_does_not_cancel_shared_work(monkeypatch, clock):
    entered = asyncio.Event()
    release = asyncio.Event()
    calls = 0

    async def provider(request):
        nonlocal calls
        if request.url.path.endswith('issue-token'):
            return _token()
        calls += 1
        entered.set()
        await release.wait()
        return _cities()

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    revision = Revision(1, encrypted_credentials='sealed')
    first = asyncio.create_task(pathao_catalog.choices('shop', 'sandbox', revision, 'city'))
    await asyncio.wait_for(entered.wait(), 2)
    second = asyncio.create_task(pathao_catalog.choices('shop', 'sandbox', revision, 'city'))
    await asyncio.sleep(0)
    first.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first
    release.set()
    assert (await second)[0].id == 5
    assert calls == 1
    assert not pathao_catalog._inflight


async def test_short_lived_token_is_replaced_before_provider_expiry(monkeypatch, clock):
    calls = 0

    async def provider(request):
        nonlocal calls
        if request.url.path.endswith('issue-token'):
            calls += 1
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 1,
                                             'access_token': f'token-{calls}'})
        return _zones() if request.url.path.endswith('zone-list') else _cities()

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    revision = Revision(1, encrypted_credentials='sealed')
    assert (await pathao_catalog.choices('shop', 'sandbox', revision, 'city'))[0].id == 5
    clock[0] += 0.95
    assert (await pathao_catalog.choices('shop', 'sandbox', revision, 'zone', 5))[0].id == 6
    assert calls == 2


async def test_shared_failure_releases_the_flight_and_later_requests_recover(monkeypatch, clock):
    calls = 0

    async def provider(request):
        nonlocal calls
        if request.url.path.endswith('issue-token'):
            return _token()
        calls += 1
        return httpx.Response(503) if calls == 1 else _cities()

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    revision = Revision(1, encrypted_credentials='sealed')
    with pytest.raises(SellerDomainException):
        await pathao_catalog.choices('shop', 'sandbox', revision, 'city')
    assert not pathao_catalog._inflight
    assert (await pathao_catalog.choices('shop', 'sandbox', revision, 'city'))[0].id == 5
    assert calls == 2


async def test_cooldown_is_scoped_to_shop_environment_and_revision(monkeypatch, clock):
    import json

    calls = []

    def unseal(sealed):
        return MerchantCredentials(client_id='id', client_secret='secret',
                                   username=sealed, password='pass')

    async def provider(request):
        calls.append((request.url.host, request.url.path))
        if request.url.path.endswith('issue-token'):
            username = json.loads(request.content)['username']
            if username == 'blocked' and request.url.host.startswith('courier-api-sandbox'):
                return httpx.Response(429)
            return _token()
        return _cities()

    monkeypatch.setattr(access, 'unseal', unseal)
    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(provider))
    blocked = Revision(1, encrypted_credentials='blocked')
    with pytest.raises(SellerDomainException):
        await pathao_catalog.choices('shop-a', 'sandbox', blocked, 'city')
    assert len(calls) == 1

    # Another shop, another revision and another environment each retain authority.
    assert (await pathao_catalog.choices('shop-b', 'sandbox', Revision(1, encrypted_credentials='allowed'), 'city'))[0].id == 5
    assert (await pathao_catalog.choices('shop-a', 'sandbox', Revision(2, encrypted_credentials='allowed'), 'city'))[0].id == 5
    assert (await pathao_catalog.choices('shop-a', 'production', blocked, 'city'))[0].id == 5
    assert len(calls) == 7

    # The original blocked scope remains cooling down without another provider call.
    with pytest.raises(SellerDomainException):
        await pathao_catalog.choices('shop-a', 'sandbox', blocked, 'city')
    assert len(calls) == 7


async def test_token_list_and_cooldown_stores_remain_bounded(monkeypatch, clock):
    async def fetch(*args):
        return []

    monkeypatch.setattr(pathao_catalog, '_fetch_list', fetch)
    for index in range(200):
        await pathao_catalog.choices(f'shop-{index}', 'sandbox', Revision(1), 'city')
    assert len(pathao_catalog._cache) <= pathao_catalog._CACHE_CAPACITY
    for index in range(200):
        pathao_catalog._record_rate_limit((f'shop-{index}', 'sandbox', 1), 60)
    assert len(pathao_catalog._cooldowns) <= pathao_catalog._COOLDOWN_CAPACITY
    for index in range(200):
        access._tokens[(f'shop-{index}', 'sandbox', 1)] = (clock[0] + 60, 'synthetic')
    access._bounded(access._tokens, access._TOKEN_CAPACITY)
    assert len(access._tokens) <= access._TOKEN_CAPACITY
    for index in range(200):
        access._auth_cooldowns[(f'shop-{index}', 'sandbox', 1)] = (clock[0] + 60, 1)
    access._bounded(access._auth_cooldowns, access._AUTH_COOLDOWN_CAPACITY)
    assert len(access._auth_cooldowns) <= access._AUTH_COOLDOWN_CAPACITY
    assert not pathao_catalog._inflight
