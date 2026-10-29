"""Mocked sandbox booking checks; never calls a live provider."""
import httpx
import pytest
from pathao_sandbox_support import (
    CONSIGNMENT,
    booking_snapshot,
    create_calls,
    sandbox_credentials,
    sandbox_settings,  # noqa: F401
)
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.parametrize('scenario,expected', [
    ('rejected', 'definitive'),
    ('rate_limited', 'definitive'),
    ('server_error', 'ambiguous'),
    ('malformed', 'ambiguous'),
    ('wrong_order', 'ambiguous'),
    ('empty_consignment', 'ambiguous'),
])
async def test_sandbox_transport_classifies_without_replaying(monkeypatch, scenario, expected):
    from app.services import pathao_booking_transport, pathao_provider

    calls: list[httpx.Request] = []

    async def handler(request: httpx.Request):
        calls.append(request)
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60,
                                             'access_token': 'sandbox-access-token'})
        if scenario == 'rejected':
            return httpx.Response(422, json={'error': 'invalid store'})
        if scenario == 'rate_limited':
            return httpx.Response(429, json={'error': 'slow down'})
        if scenario == 'server_error':
            return httpx.Response(500, json={'error': 'unknown'})
        if scenario == 'malformed':
            return httpx.Response(200, json={'unexpected': True})
        data = {'consignment_id': '', 'merchant_order_id': 'order-sandbox-1'} \
            if scenario == 'empty_consignment' else {
                'consignment_id': CONSIGNMENT,
                'merchant_order_id': 'another-order' if scenario == 'wrong_order' else 'order-sandbox-1',
            }
        return httpx.Response(200, json={'data': data})

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(handler))
    with pytest.raises((pathao_provider.CourierDefinitiveFailure, RuntimeError, ValueError)) as caught:
        await pathao_booking_transport.submit('sandbox', booking_snapshot(), sandbox_credentials())
    if expected == 'definitive':
        assert isinstance(caught.value, pathao_provider.CourierDefinitiveFailure)
    else:
        assert not isinstance(caught.value, pathao_provider.CourierDefinitiveFailure)
    assert len(create_calls(calls)) == 1


async def test_sandbox_transport_timeout_and_auth_rejection_are_not_replayed(monkeypatch):
    from app.services import pathao_booking_transport, pathao_provider

    calls: list[httpx.Request] = []

    async def timeout_handler(request: httpx.Request):
        calls.append(request)
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60,
                                             'access_token': 'sandbox-access-token'})
        raise httpx.ReadTimeout('synthetic timeout')

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(timeout_handler))
    with pytest.raises(httpx.TimeoutException):
        await pathao_booking_transport.submit('sandbox', booking_snapshot(), sandbox_credentials())
    assert len(create_calls(calls)) == 1

    calls.clear()

    async def auth_handler(request: httpx.Request):
        calls.append(request)
        return httpx.Response(401, json={'error': 'invalid credentials'})

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(auth_handler))
    with pytest.raises(pathao_provider.CourierDefinitiveFailure):
        await pathao_booking_transport.submit('sandbox', booking_snapshot(), sandbox_credentials())
    assert create_calls(calls) == []


@pytest.mark.parametrize('overrides', [
    {'remaining_cod_minor': 50050, 'amount_to_collect_bdt': 500},
    {'item_weight_grams': 400},
    {'item_weight_grams': 10001},
    {'recipient_phone': '+8801711111111'},
    {'area_id': None},
    {'recipient_address': 'short'},
])
async def test_sandbox_transport_rejects_unsupported_contract_values(monkeypatch, overrides):
    from app.services import pathao_booking_transport, pathao_provider

    async def handler(request: httpx.Request):
        raise AssertionError('No provider request should be sent for invalid local facts.')

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(handler))
    with pytest.raises(pathao_provider.CourierDefinitiveFailure):
        await pathao_booking_transport.submit('sandbox', booking_snapshot(**overrides), sandbox_credentials())


@pytest.mark.parametrize('lookup_response', [
    {'consignment_id': CONSIGNMENT, 'merchant_order_id': 'another-order', 'store_id': 321},
    {'consignment_id': CONSIGNMENT, 'merchant_order_id': 'order-sandbox-1', 'store_id': 999},
    {'consignment_id': 'PT-OTHER-1', 'merchant_order_id': 'order-sandbox-1', 'store_id': 321},
])
async def test_sandbox_lookup_rejects_mismatched_evidence(monkeypatch, lookup_response):
    from app.services import pathao_booking_transport, pathao_provider

    async def handler(request: httpx.Request):
        if request.url.path.endswith('issue-token'):
            return httpx.Response(200, json={'token_type': 'Bearer', 'expires_in': 60,
                                             'access_token': 'sandbox-access-token'})
        return httpx.Response(200, json={'data': lookup_response})

    monkeypatch.setattr('app.services.pathao_provider.transport', lambda: httpx.MockTransport(handler))
    with pytest.raises(pathao_provider.CourierEvidenceUnavailable):
        await pathao_booking_transport.lookup(
            'sandbox', sandbox_credentials(), CONSIGNMENT, 'order-sandbox-1', 321,
        )
