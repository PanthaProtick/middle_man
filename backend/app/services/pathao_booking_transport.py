"""Narrow Pathao sandbox create-order and consignment lookup transport.

No automatic replay: transport retries are disabled and a create-order POST is
issued at most once per call. Ambiguous failures propagate for the caller to
classify; only explicit validation/auth/rate-limit rejections are definitive.
"""
import asyncio
import json
import re
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.models.courier_submission import CourierBookingSnapshot
from app.models.pathao import Environment, MerchantCredentials
from app.services import pathao_provider as provider

_BD_PHONE = re.compile(r'^01[3-9]\d{8}$')
_CONSIGNMENT = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
_MAX_BODY = 1024 * 1024
_REJECTED_STATUSES = frozenset({400, 401, 403, 404, 422, 429})


class _OrderData(BaseModel):
    model_config = ConfigDict(extra='ignore', coerce_numbers_to_str=True)
    consignment_id: str = Field(min_length=1, max_length=64)
    merchant_order_id: str | None = Field(default=None, max_length=64)
    store_id: int | None = None
    order_status: str | None = Field(default=None, max_length=64)


class _OrderEnvelope(BaseModel):
    model_config = ConfigDict(extra='ignore')
    data: _OrderData


def _definitive(message: str) -> provider.CourierDefinitiveFailure:
    return provider.CourierDefinitiveFailure(message)


def booking_payload(request: CourierBookingSnapshot) -> dict[str, Any]:
    """Translate validated server facts; reject unsupported values instead of guessing."""
    name = request.recipient_name.strip()
    phone = request.recipient_phone.strip()
    address = request.recipient_address.strip()
    if not 3 <= len(name) <= 100:
        raise _definitive('Recipient name does not meet the courier contract.')
    if not _BD_PHONE.fullmatch(phone):
        raise _definitive('Recipient contact phone does not meet the courier contract.')
    if not 10 <= len(address) <= 220:
        raise _definitive('Recipient delivery address does not meet the courier contract.')
    if request.city_id <= 0 or request.zone_id <= 0 or request.area_id is None or request.area_id <= 0:
        raise _definitive('A complete resolved destination is required for courier booking.')
    if request.store_id <= 0:
        raise _definitive('The selected pickup store is invalid.')
    if request.delivery_type not in (48, 12):
        raise _definitive('The selected delivery service is unsupported.')
    if request.item_quantity <= 0:
        raise _definitive('Item quantity must be positive.')
    if not 500 <= request.item_weight_grams <= 10000:
        raise _definitive('Parcel weight must be between 0.5 and 10 kg.')
    if request.remaining_cod_minor < 0:
        raise _definitive('Remaining COD balance cannot be negative.')
    if request.remaining_cod_minor % 100:
        raise _definitive('COD amount cannot be represented exactly in whole taka.')
    amount = request.remaining_cod_minor // 100
    if request.amount_to_collect_bdt != amount:
        raise _definitive('COD conversion mismatch.')
    return {
        'store_id': request.store_id,
        'merchant_order_id': request.order_id,
        'recipient_name': name,
        'recipient_phone': phone,
        'recipient_address': address,
        'recipient_city': request.city_id,
        'recipient_zone': request.zone_id,
        'recipient_area': request.area_id,
        'delivery_type': request.delivery_type,
        'item_type': 2,
        'item_quantity': request.item_quantity,
        'item_weight': request.item_weight_grams / 1000,
        'amount_to_collect': amount,
    }


def _client(env: Environment) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=provider.BASE_URLS[env],
        timeout=httpx.Timeout(10, connect=4),
        follow_redirects=False,
        trust_env=False,
        transport=provider.transport(),
        headers={'Accept': 'application/json'},
    )


def _credentials_payload(credentials: MerchantCredentials) -> dict[str, str]:
    return {name: value.get_secret_value() for name, value in credentials}


async def _request_json(
    client: httpx.AsyncClient, method: str, path: str, *,
    payload: dict[str, Any] | None = None, headers: dict[str, str] | None = None,
) -> Any:
    async with client.stream(method, path, json=payload, headers=headers) as response:
        if response.status_code in _REJECTED_STATUSES:
            raise _definitive('Pathao rejected the request.')
        if response.status_code not in (200, 201):
            raise RuntimeError('Courier returned an ambiguous response status.')
        body = bytearray()
        async for chunk in response.aiter_bytes(chunk_size=65536):
            if len(body) + len(chunk) > _MAX_BODY:
                raise RuntimeError('Courier response exceeded the accepted size.')
            body.extend(chunk)
    try:
        return json.loads(body)
    except ValueError:
        raise RuntimeError('Courier returned a malformed response body.') from None


async def _access_token(client: httpx.AsyncClient, credentials: MerchantCredentials) -> str:
    result = await _request_json(
        client, 'POST', '/aladdin/api/v1/issue-token',
        payload={**_credentials_payload(credentials), 'grant_type': 'password'},
        headers={'Content-Type': 'application/json'},
    )
    try:
        return provider.Token.model_validate(result).access_token
    except ValidationError:
        raise _definitive('Pathao authentication returned an unusable response.') from None


async def submit(
    env: Environment, request: CourierBookingSnapshot, credentials: MerchantCredentials,
) -> provider.CourierBookingResult:
    payload = booking_payload(request)
    try:
        async with asyncio.timeout(15), _client(env) as client:
            token = await _access_token(client, credentials)
            result = await _request_json(
                client, 'POST', '/aladdin/api/v1/orders', payload=payload,
                headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            )
    except (asyncio.TimeoutError, TimeoutError, httpx.TimeoutException):
        raise
    except httpx.HTTPError:
        raise RuntimeError('Courier request failed before a confirmed outcome.') from None
    try:
        order = _OrderEnvelope.model_validate(result).data
    except ValidationError:
        raise RuntimeError('Courier returned a malformed booking confirmation.') from None
    if order.merchant_order_id is not None and order.merchant_order_id != request.order_id:
        raise RuntimeError('Courier returned a mismatched merchant order reference.')
    consignment_id = order.consignment_id.strip()
    if not _CONSIGNMENT.fullmatch(consignment_id):
        raise RuntimeError('Courier returned an invalid consignment reference.')
    return provider.CourierBookingResult(
        consignment_id=consignment_id,
        merchant_order_id=request.order_id,
        is_simulated=False,
    )


async def lookup(
    env: Environment,
    credentials: MerchantCredentials,
    consignment_id: str,
    merchant_order_id: str,
    store_id: int,
) -> provider.CourierBookingEvidence:
    value = consignment_id.strip()
    if not _CONSIGNMENT.fullmatch(value):
        raise provider.CourierEvidenceUnavailable('The consignment reference is not valid.')
    try:
        async with asyncio.timeout(15), _client(env) as client:
            token = await _access_token(client, credentials)
            result = await _request_json(
                client, 'GET', f'/aladdin/api/v1/orders/{value}/info',
                headers={'Authorization': f'Bearer {token}'},
            )
        order = _OrderEnvelope.model_validate(result).data
    except provider.CourierDefinitiveFailure:
        raise provider.CourierEvidenceUnavailable('The consignment could not be verified.') from None
    except (asyncio.TimeoutError, TimeoutError, httpx.HTTPError, RuntimeError, ValueError, ValidationError):
        raise provider.CourierEvidenceUnavailable('The consignment could not be verified.') from None
    if order.consignment_id.strip() != value:
        raise provider.CourierEvidenceUnavailable('No matching consignment was returned.')
    if order.merchant_order_id is None or order.merchant_order_id != merchant_order_id:
        raise provider.CourierEvidenceUnavailable('The consignment does not match this merchant order.')
    if order.store_id is not None and order.store_id != store_id:
        raise provider.CourierEvidenceUnavailable('The consignment was created under another pickup store.')
    return provider.CourierBookingEvidence(
        consignment_id=value,
        merchant_order_id=merchant_order_id,
        environment=env,
        store_id=store_id,
        is_simulated=False,
    )
