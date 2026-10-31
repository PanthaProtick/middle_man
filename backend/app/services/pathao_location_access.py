"""Process-local Pathao token reuse and authenticated list transport for buyer lookups."""
import asyncio
from collections import OrderedDict
from typing import Literal, TypeVar

import httpx

from app.models.pathao import Environment
from app.services import pathao_provider as provider
from app.services.pathao_connections import Revision
from app.services.pathao_secrets import unseal
from app.services.seller_service import SellerDomainException

Level = Literal['city', 'zone', 'area']
TokenKey = tuple[str, Environment, int]

_TOKEN_CAPACITY = 128
_LOCK_CAPACITY = 128
_AUTH_COOLDOWN_CAPACITY = 128
_MAX_COOLDOWN_SECONDS = 3600.0
_FALLBACK_BASE_SECONDS = 5.0
_FALLBACK_MAX_SECONDS = 300.0
_tokens: OrderedDict[TokenKey, tuple[float, str]] = OrderedDict()
_locks: OrderedDict[TokenKey, asyncio.Lock] = OrderedDict()
_auth_cooldowns: OrderedDict[TokenKey, tuple[float, int]] = OrderedDict()
_Value = TypeVar('_Value')


class AuthRateLimited(provider.ProviderRateLimited):
    """Token issuance was rate limited, distinct from a list endpoint limit."""


def clear_access() -> None:
    _tokens.clear()
    _locks.clear()
    _auth_cooldowns.clear()


def _token_key(shop: str, env: Environment, revision: Revision) -> TokenKey:
    return (shop, env, revision.version)


def _bounded(store: OrderedDict[TokenKey, _Value], capacity: int) -> None:
    while len(store) > capacity:
        store.popitem(last=False)


def _cooling(key: TokenKey, now: float) -> bool:
    entry = _auth_cooldowns.get(key)
    if entry is None:
        return False
    if entry[0] <= now:
        _auth_cooldowns.pop(key, None)
        return False
    return True


def _record_auth_limit(key: TokenKey, now: float, retry_after: float | None) -> None:
    failures = _auth_cooldowns.get(key, (0.0, 0))[1] + 1
    delay = (min(retry_after, _MAX_COOLDOWN_SECONDS) if retry_after is not None
             else min(_FALLBACK_MAX_SECONDS, _FALLBACK_BASE_SECONDS * 2 ** min(failures - 1, 6)))
    _auth_cooldowns[key] = (now + delay, failures)
    _auth_cooldowns.move_to_end(key)
    _bounded(_auth_cooldowns, _AUTH_COOLDOWN_CAPACITY)


def _lock(key: TokenKey) -> asyncio.Lock:
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _locks[key] = lock
    _locks.move_to_end(key)
    while len(_locks) > _LOCK_CAPACITY and not next(iter(_locks.values())).locked():
        _locks.popitem(last=False)
    return lock


async def token(shop: str, env: Environment, revision: Revision, now: float) -> tuple[str, bool]:
    """Return a reusable token and whether it came from the cache."""
    key = _token_key(shop, env, revision)
    hit = _tokens.get(key)
    if hit and hit[0] > now:
        _tokens.move_to_end(key)
        return hit[1], True
    _tokens.pop(key, None)
    if _cooling(key, now):
        raise provider.unavailable()
    async with _lock(key):
        hit = _tokens.get(key)
        if hit and hit[0] > now:
            _tokens.move_to_end(key)
            return hit[1], True
        _tokens.pop(key, None)
        if _cooling(key, now):
            raise provider.unavailable()
        credentials = unseal(revision.encrypted_credentials)
        if credentials is None:
            raise provider.unavailable()
        try:
            async with httpx.AsyncClient(base_url=provider.BASE_URLS[env], timeout=httpx.Timeout(5, connect=3),
                                         follow_redirects=False, trust_env=False, transport=provider.transport(),
                                         headers={'Accept': 'application/json'}) as client:
                issued = provider.Token.model_validate(await provider.request_json(
                    client, 'POST', '/aladdin/api/v1/issue-token', payload={
                        **{name: value.get_secret_value() for name, value in credentials},
                        'grant_type': 'password'}))
        except provider.ProviderRateLimited as error:
            _record_auth_limit(key, now, error.retry_after)
            raise AuthRateLimited(error.retry_after) from None
        except (httpx.HTTPError, ValueError, TimeoutError):
            raise provider.unavailable() from None
        _auth_cooldowns.pop(key, None)
        _tokens[key] = (now + issued.expires_in * 0.9, issued.access_token)
        _tokens.move_to_end(key)
        _bounded(_tokens, _TOKEN_CAPACITY)
        return issued.access_token, False


def path(level: Level, parent: int | None) -> str:
    return '/aladdin/api/v1/' + (
        'city-list' if level == 'city' else f'cities/{parent}/zone-list' if level == 'zone' else f'zones/{parent}/area-list')


async def _read(env: Environment, token_value: str, level: Level, parent: int | None) -> object:
    async with httpx.AsyncClient(base_url=provider.BASE_URLS[env], timeout=httpx.Timeout(5, connect=3),
                                 follow_redirects=False, trust_env=False, transport=provider.transport(),
                                 headers={'Accept': 'application/json'}) as client:
        return await provider.request_json(client, 'GET', path(level, parent),
                                           headers={'Authorization': f'Bearer {token_value}'})


def _rejected(error: SellerDomainException) -> bool:
    detail = error.detail
    return isinstance(detail, dict) and detail.get('code') == 'PATHAO_CREDENTIALS_REJECTED'


async def read(shop: str, env: Environment, revision: Revision, level: Level,
               parent: int | None, now: float) -> tuple[object, bool]:
    token_value, cached = await token(shop, env, revision, now)
    try:
        return await _read(env, token_value, level, parent), cached
    except SellerDomainException as error:
        if not (cached and _rejected(error)):
            raise
        _tokens.pop(_token_key(shop, env, revision), None)
        token_value, _ = await token(shop, env, revision, now)
        return await _read(env, token_value, level, parent), False
