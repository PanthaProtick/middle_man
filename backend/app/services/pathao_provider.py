"""Courier adapter boundary: bounded auth/stores and explicitly enabled bookings.

No automatic retries or token retention; production creation requires explicit opt-in.
"""
import asyncio
import hashlib
import json
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.config import settings
from app.models.courier_submission import CourierBookingSnapshot
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


class CourierDefinitiveFailure(Exception):
    """Definitive noncreation failure from courier provider."""
    pass


class CourierEvidenceUnavailable(Exception):
    """Provider cannot verify that the supplied consignment exists for this account."""


class CourierBookingEvidence(BaseModel):
    model_config = ConfigDict(extra='forbid')
    consignment_id: str
    merchant_order_id: str
    environment: Environment
    store_id: int
    is_simulated: bool


def simulated_consignment(shop: str, order_id: str, store_id: int) -> str:
    digest = hashlib.sha256(f"{shop}:{order_id}:{store_id}".encode()).hexdigest()[:12].upper()
    return f"SIM-PATHAO-{digest}"


class CourierBookingResult(BaseModel):
    model_config = ConfigDict(extra='forbid')
    consignment_id: str
    merchant_order_id: str
    is_simulated: bool = False


async def submit_booking(
    shop: str, env: Environment, request: CourierBookingSnapshot,
    credentials: MerchantCredentials | None = None,
) -> CourierBookingResult:
    if env != 'offline':
        if env == 'production' and not settings.PATHAO_PRODUCTION_BOOKING_ENABLED:
            raise CourierDefinitiveFailure('Production booking is disabled.')
        if credentials is None:
            raise CourierDefinitiveFailure('Pathao merchant credentials are required.')
        from app.services import pathao_booking_transport
        return await pathao_booking_transport.submit(env, request, credentials)
    if request.remaining_cod_minor < 0:
        raise CourierDefinitiveFailure('Remaining COD balance cannot be negative.')
    expected_bdt = request.remaining_cod_minor // 100
    if request.amount_to_collect_bdt != expected_bdt:
        raise CourierDefinitiveFailure('COD conversion mismatch.')
    if not request.recipient_phone.strip() or len(request.recipient_phone.strip()) < 11:
        raise CourierDefinitiveFailure('Recipient contact phone is invalid.')
    if not request.recipient_address.strip() or len(request.recipient_address.strip()) < 5:
        raise CourierDefinitiveFailure('Recipient delivery address is incomplete.')
    if request.city_id <= 0 or request.zone_id <= 0 or request.store_id <= 0:
        raise CourierDefinitiveFailure('Pickup store, city, and zone locations are required.')
    if request.item_weight_grams <= 0 or request.item_quantity <= 0:
        raise CourierDefinitiveFailure('Package weight and item quantity must be positive.')

    return CourierBookingResult(
        consignment_id=simulated_consignment(shop, request.order_id, request.store_id),
        merchant_order_id=request.order_id,
        is_simulated=True,
    )


async def lookup_booking(
    shop: str, env: Environment, consignment_id: str, merchant_order_id: str, store_id: int,
    credentials: MerchantCredentials | None = None,
) -> CourierBookingEvidence:
    """Verifies an existing consignment against the account, order reference, and environment."""
    if env != 'offline':
        if credentials is None:
            raise CourierEvidenceUnavailable('Consignment verification is unavailable for this connection.')
        from app.services import pathao_booking_transport
        return await pathao_booking_transport.lookup(
            env, credentials, consignment_id, merchant_order_id, store_id,
        )
    expected = simulated_consignment(shop, merchant_order_id, store_id)
    if consignment_id.strip().upper() != expected:
        raise CourierEvidenceUnavailable('No matching consignment was found for this account and order reference.')
    return CourierBookingEvidence(
        consignment_id=expected,
        merchant_order_id=merchant_order_id,
        environment=env,
        store_id=store_id,
        is_simulated=True,
    )

