"""Bounded async authentication/store adapter. No bookings, retries or token retention."""
import asyncio
import hashlib
import json
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.models.pathao import Environment, MerchantCredentials, PickupStore
from app.services.seller_service import SellerDomainException

BASE_URLS = {'sandbox': 'https://courier-api-sandbox.pathao.com',
             'production': 'https://api-hermes.pathao.com'}


def transport() -> httpx.AsyncBaseTransport:
    return httpx.AsyncHTTPTransport(retries=0)


class Token(BaseModel):
    access_token: str = Field(min_length=1, max_length=8192)
    token_type: Literal['Bearer']
    expires_in: int = Field(gt=0)


class ProviderStore(BaseModel):
    model_config = ConfigDict(strict=True)
    store_id: int = Field(gt=0)
    store_name: str = Field(min_length=1, max_length=200)
    is_active: Literal[0, 1]


class StorePage(BaseModel):
    data: list[ProviderStore] = Field(max_length=100)
    current_page: int = Field(ge=1)
    last_page: int = Field(ge=1, le=20)


class StoreEnvelope(BaseModel):
    data: StorePage


def unavailable() -> SellerDomainException:
    return SellerDomainException(503, 'PATHAO_UNAVAILABLE',
                                 'Pathao stores are unavailable. Your saved settings are unchanged; retry later.')


def check_response(response: httpx.Response) -> None:
    if response.status_code in (400, 401, 403, 422):
        raise SellerDomainException(422, 'PATHAO_CREDENTIALS_REJECTED',
                                     'Pathao rejected access. Check credentials and merchant permissions.')
    if response.status_code != 200:
        raise unavailable()


async def request_json(client: httpx.AsyncClient, method: str, path: str, *,
                       payload: dict[str, str] | None = None, params: dict[str, int] | None = None,
                       headers: dict[str, str] | None = None) -> object:
    async with client.stream(method, path, json=payload, params=params, headers=headers) as response:
        check_response(response)
        body = bytearray()
        async for chunk in response.aiter_bytes(chunk_size=65536):
            if len(body) + len(chunk) > 1024 * 1024:
                raise unavailable()
            body.extend(chunk)
        result: object = json.loads(body)
        return result


async def list_stores(shop: str, env: Environment, credentials: MerchantCredentials | None) -> list[PickupStore]:
    if env == 'offline':
        fixture_id = int(hashlib.sha256(shop.encode()).hexdigest()[:7], 16) + 1
        return [PickupStore(id=fixture_id, name='Simulated pickup store')]
    if credentials is None:
        raise SellerDomainException(422, 'PATHAO_CREDENTIALS_REQUIRED', 'Enter all merchant credentials.')
    try:
        async with asyncio.timeout(20), httpx.AsyncClient(
            base_url=BASE_URLS[env], timeout=httpx.Timeout(8, connect=4),
            follow_redirects=False, trust_env=False, transport=transport(),
            headers={'Accept': 'application/json'},
        ) as client:
            payload = {name: value.get_secret_value() for name, value in credentials}
            token = Token.model_validate(await request_json(client, 'POST', '/aladdin/api/v1/issue-token',
                                                           payload={**payload, 'grant_type': 'password'}))
            stores: list[PickupStore] = []
            for page in range(1, 21):
                result = StoreEnvelope.model_validate(await request_json(
                    client, 'GET', '/aladdin/api/v1/stores', params={'page': page, 'per_page': 100},
                    headers={'Authorization': f'Bearer {token.access_token}'},
                )).data
                if result.current_page != page or result.last_page < page:
                    raise unavailable()
                stores.extend(PickupStore(id=s.store_id, name=s.store_name) for s in result.data if s.is_active == 1)
                if page == result.last_page:
                    if len({s.id for s in stores}) != len(stores):
                        raise unavailable()
                    return stores
            raise unavailable()
    except (httpx.HTTPError, ValueError, ValidationError, TimeoutError):
        raise unavailable() from None
