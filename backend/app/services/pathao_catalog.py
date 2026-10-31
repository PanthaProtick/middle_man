"""Bounded, tenant/revision-scoped catalog cache; stores no credentials or buyer data."""
import asyncio
from collections import OrderedDict
from time import monotonic
from typing import Literal

import httpx
from pydantic import ValidationError

from app.models.pathao import Environment
from app.models.pathao_location import LocationChoice
from app.services import pathao_provider as provider
from app.services.pathao_connections import Revision
from app.services.pathao_secrets import unseal
from app.services.seller_service import SellerDomainException

Level = Literal['city', 'zone', 'area']
_cache: OrderedDict[tuple[str, Environment, int, Level, int | None], tuple[float, list[LocationChoice]]] = OrderedDict()
_capacity = asyncio.Semaphore(4)


def clear_cache() -> None:
    _cache.clear()


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


async def fetch(env: Environment, revision: Revision, level: Level, parent: int | None) -> list[LocationChoice]:
    if env == 'offline':
        return simulated(level, parent)
    credentials = unseal(revision.encrypted_credentials)
    if credentials is None:
        raise provider.unavailable()
    path = '/aladdin/api/v1/' + (
        'city-list' if level == 'city' else f'cities/{parent}/zone-list' if level == 'zone' else f'zones/{parent}/area-list')
    async with httpx.AsyncClient(base_url=provider.BASE_URLS[env], timeout=httpx.Timeout(5, connect=3),
                                 follow_redirects=False, trust_env=False, transport=provider.transport()) as client:
        token = provider.Token.model_validate(await provider.request_json(
            client, 'POST', '/aladdin/api/v1/issue-token', payload={
                **{name: value.get_secret_value() for name, value in credentials}, 'grant_type': 'password'}))
        result = await provider.request_json(client, 'GET', path, headers={'Authorization': f'Bearer {token.access_token}'})
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


async def choices(shop: str, env: Environment, revision: Revision, level: Level,
                  parent: int | None = None, *, fresh: bool = False) -> list[LocationChoice]:
    key = (shop, env, revision.version, level, parent)
    hit = _cache.get(key)
    if not fresh and hit and hit[0] > monotonic():
        _cache.move_to_end(key)
        return hit[1]
    try:
        async with asyncio.timeout(8), _capacity:
            result = await fetch(env, revision, level, parent)
    except (httpx.HTTPError, ValueError, ValidationError, TimeoutError):
        raise provider.unavailable() from None
    _cache[key] = (monotonic() + 300, result)
    _cache.move_to_end(key)
    while len(_cache) > 128:
        _cache.popitem(last=False)
    return result


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
