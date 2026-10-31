"""On-demand, tenant/revision-scoped location lists with bounded process-local coordination."""
import asyncio
from collections import OrderedDict
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from functools import partial
from time import monotonic
from typing import Literal, TypeVar

import httpx
from pydantic import ValidationError

from app.models.pathao import Environment
from app.models.pathao_location import LocationChoice
from app.services import pathao_location_access as access
from app.services import pathao_provider as provider
from app.services.pathao_connections import Revision
from app.services.seller_service import SellerDomainException

Level = Literal['city', 'zone', 'area']
CacheKey = tuple[str, Environment, int, Level, int | None]
CooldownKey = tuple[str, Environment, int]
_Key = TypeVar('_Key')
_Value = TypeVar('_Value')

_LIST_TTL = 300.0
_CACHE_CAPACITY = 128
_COOLDOWN_CAPACITY = 128
_MAX_COOLDOWN_SECONDS = 3600.0
_FALLBACK_BASE_SECONDS = 5.0
_FALLBACK_MAX_SECONDS = 300.0

_cache: OrderedDict[CacheKey, tuple[float, list[LocationChoice]]] = OrderedDict()
_inflight: dict[tuple[CacheKey, bool], asyncio.Task[list[LocationChoice]]] = {}
_cooldowns: OrderedDict[CooldownKey, tuple[float, int]] = OrderedDict()
_capacity = asyncio.Semaphore(4)


def clear_cache() -> None:
    """Clear all process-local provider coordination between isolated tests or workers."""
    _cache.clear()
    _inflight.clear()
    _cooldowns.clear()
    access.clear_access()


def _bounded(store: OrderedDict[_Key, _Value], capacity: int) -> None:
    while len(store) > capacity:
        store.popitem(last=False)


class InvalidLocation(SellerDomainException):
    def __init__(self, code: str = 'PATHAO_LOCATION_INVALID',
                 message: str = 'Choose locations from the selected parent, or mark the destination as unsupported.',
                 field: str | None = None) -> None:
        fields: list[dict[str, object]] | None = [{'field': field, 'code': code.lower(), 'message': message}] if field else None
        super().__init__(422, code, message, fields=fields)


def invalid(level: Level) -> InvalidLocation:
    return InvalidLocation(field=f'address.pathao.{level}_id')


def required(level: Level) -> InvalidLocation:
    return InvalidLocation(
        'PATHAO_LOCATION_REQUIRED',
        f'Choose an available Pathao {level}, or mark the destination as unsupported.',
        field=f'address.pathao.{level}_id',
    )


def simulated(level: Level, parent: int | None) -> list[LocationChoice]:
    if level == 'city':
        return [LocationChoice(id=1, name='Simulated Dhaka'), LocationChoice(id=2, name='Simulated Chattogram')]
    if level == 'zone':
        return [LocationChoice(id=10, name='Simulated central'), LocationChoice(id=11, name='Simulated no-area zone')] if parent == 1 else []
    return [LocationChoice(id=100, name='Simulated covered area', home_delivery_available=True),
            LocationChoice(id=101, name='Simulated unsupported area', home_delivery_available=False)] if parent == 10 else []


def _cooldown_key(shop: str, env: Environment, revision: Revision) -> CooldownKey:
    return (shop, env, revision.version)


def _cooldown_remaining(key: CooldownKey) -> float:
    entry = _cooldowns.get(key)
    if entry is None:
        return 0.0
    remaining = entry[0] - monotonic()
    if remaining <= 0:
        _cooldowns.pop(key, None)
        return 0.0
    return remaining


def _raise_if_cooling(key: CooldownKey) -> None:
    if _cooldown_remaining(key) > 0:
        raise provider.unavailable()


def _record_rate_limit(key: CooldownKey, retry_after: float | None) -> None:
    failures = _cooldowns.get(key, (0.0, 0))[1] + 1
    delay = (min(retry_after, _MAX_COOLDOWN_SECONDS) if retry_after is not None
             else min(_FALLBACK_MAX_SECONDS, _FALLBACK_BASE_SECONDS * 2 ** min(failures - 1, 6)))
    _cooldowns[key] = (monotonic() + delay, failures)
    _cooldowns.move_to_end(key)
    _bounded(_cooldowns, _COOLDOWN_CAPACITY)


def _record_success(key: CooldownKey) -> None:
    _cooldowns.pop(key, None)


def _parse(result: object, level: Level) -> list[LocationChoice]:
    # Owning SDK accepts nested data.data or direct data lists. Never infer absent lists.
    if isinstance(result, dict):
        result = result.get('data')
    if isinstance(result, dict):
        result = result.get('data')
    if not isinstance(result, list) or len(result) > 5000:
        raise provider.unavailable()
    choices = []
    for row in result:
        if not isinstance(row, dict):
            raise provider.unavailable()
        coverage = row.get('home_delivery_available') if level == 'area' else None
        if level == 'area' and type(coverage) is not bool:
            # SDK declares boolean; never turn an unknown value into supported coverage.
            raise provider.unavailable()
        choices.append(LocationChoice.model_validate({'id': row.get(level + '_id'), 'name': row.get(level + '_name'),
                                                      'home_delivery_available': coverage}))
    if len({item.id for item in choices}) != len(choices):
        raise provider.unavailable()
    return choices


async def _fetch_list(shop: str, env: Environment, revision: Revision,
                      level: Level, parent: int | None) -> list[LocationChoice]:
    location_key = _cooldown_key(shop, env, revision)
    _raise_if_cooling(location_key)
    try:
        result, _ = await access.read(shop, env, revision, level, parent, monotonic())
        choices = _parse(result, level)
    except access.AuthRateLimited:
        raise provider.unavailable() from None
    except provider.ProviderRateLimited as error:
        _record_rate_limit(location_key, error.retry_after)
        raise provider.unavailable() from None
    except (httpx.HTTPError, ValueError, ValidationError, TimeoutError):
        raise provider.unavailable() from None
    _record_success(location_key)
    return choices


async def fetch(shop: str, env: Environment, revision: Revision, level: Level,
                parent: int | None) -> list[LocationChoice]:
    if env == 'offline':
        return simulated(level, parent)
    return await _fetch_list(shop, env, revision, level, parent)


@asynccontextmanager
async def reader(shop: str, env: Environment, revision: Revision) -> AsyncIterator[
    Callable[[Level, int | None], Awaitable[list[LocationChoice]]]
]:
    """Reuse authentication for a seller crawl; each list still has its own failure boundary."""
    if env == 'offline':
        yield partial(fetch, shop, env, revision)
        return
    yield partial(_fetch_list, shop, env, revision)


def _release(flight_key: tuple[CacheKey, bool], task: asyncio.Task[list[LocationChoice]]) -> None:
    if _inflight.get(flight_key) is task:
        _inflight.pop(flight_key, None)
    if not task.cancelled():
        task.exception()  # Mark a shared failure as observed even if every waiter was cancelled.


async def _load(shop: str, env: Environment, revision: Revision, key: CacheKey,
                level: Level, parent: int | None) -> list[LocationChoice]:
    try:
        async with asyncio.timeout(8), _capacity:
            result = await _fetch_list(shop, env, revision, level, parent)
    except (httpx.HTTPError, ValueError, ValidationError, TimeoutError):
        raise provider.unavailable() from None
    _cache[key] = (monotonic() + _LIST_TTL, result)
    _cache.move_to_end(key)
    _bounded(_cache, _CACHE_CAPACITY)
    return result


async def choices(shop: str, env: Environment, revision: Revision, level: Level,
                  parent: int | None = None, *, fresh: bool = False) -> list[LocationChoice]:
    if env == 'offline':
        return simulated(level, parent)
    key: CacheKey = (shop, env, revision.version, level, parent)
    if not fresh:
        hit = _cache.get(key)
        if hit and hit[0] > monotonic():
            _cache.move_to_end(key)
            return hit[1]
        _cache.pop(key, None)
    flight_key = (key, fresh)
    task = _inflight.get(flight_key)
    if task is None:
        task = asyncio.create_task(_load(shop, env, revision, key, level, parent))
        _inflight[flight_key] = task
        task.add_done_callback(partial(_release, flight_key))
    # A cancelled buyer request must not cancel work shared with other buyers.
    return await asyncio.shield(task)


def member(options: list[LocationChoice], selected: int, level: Level) -> LocationChoice:
    found = next((item for item in options if item.id == selected), None)
    if found is None:
        raise invalid(level)
    return found


async def hierarchy(shop: str, env: Environment, revision: Revision,
                    city: int | None = None, zone: int | None = None) -> list[LocationChoice]:
    """Return one level only after validating its complete parent chain."""
    if zone is not None and city is None:
        raise invalid('city')
    try:
        async with asyncio.timeout(10):
            options = await choices(shop, env, revision, 'city')
            if city is not None:
                member(options, city, 'city')
                options = await choices(shop, env, revision, 'zone', city)
            if zone is not None:
                member(options, zone, 'zone')
                options = await choices(shop, env, revision, 'area', zone)
            return options
    except TimeoutError:
        raise provider.unavailable() from None
