"""Address AI is retired: no route, no provider work, manual entry preserved."""
import copy
import importlib.util

import httpx
import pytest
from buyer_postgres_support import PAYLOAD
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity  # noqa: F401

from app.core.config import settings
from app.main import app

__all__ = ['clean_memory_stores', 'seller_identity']

STRUCTURED_PAYLOAD = {
    **copy.deepcopy(PAYLOAD),
    'address': {
        'raw_text': 'House 12, Road 5, Dhanmondi, Dhaka',
        'district': 'Dhaka',
        'thana': 'Dhanmondi',
        'area': 'Road 5',
        'street_line': 'House 12',
        'landmark': 'Beside the park',
    },
}


@pytest.fixture(autouse=True)
def fail_on_outbound_provider_calls(monkeypatch):
    async def forbid(self, request):  # pragma: no cover - must never run
        raise AssertionError('Retired address AI attempted an outbound provider call')

    monkeypatch.setattr(httpx.AsyncHTTPTransport, 'handle_async_request', forbid)


def test_retired_address_ai_modules_and_openapi_surface_are_absent():
    for module in (
        'app.models.address_assistance',
        'app.models.address_entities',
        'app.services.address_assistance',
        'app.services.address_provider',
    ):
        assert importlib.util.find_spec(module) is None
    assert not hasattr(settings, 'ai_assistance_available')
    paths = app.openapi()['paths']
    assert not any('address' in path or 'extraction' in path for path in paths)


@pytest.mark.asyncio
async def test_retired_extraction_route_is_absent_for_valid_and_unknown_links(client, seller_identity):
    order = await _create_test_order(client)
    for token in (order['portal_token'], 'unknown'):
        response = await client.post(f'/api/public/orders/{token}/address-extraction',
            json={'raw_text': 'Synthetic Dhaka address', 'ai_opt_in': True},
            headers={'Idempotency-Key': 'retired'})
        assert response.status_code == 404
        assert response.headers['cache-control'] == 'no-store, private'
    public = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert 'ai_assistance_available' not in public


@pytest.mark.asyncio
async def test_configured_credentials_do_not_restore_address_parsing(client, seller_identity, monkeypatch):
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', 'synthetic-key')
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    order = await _create_test_order(client)
    response = await client.post(f"/api/public/orders/{order['portal_token']}/address-extraction",
        json={'raw_text': 'Synthetic Dhaka address', 'ai_opt_in': True},
        headers={'Idempotency-Key': 'retired'})
    assert response.status_code == 404
    submitted = await client.post(f"/api/public/orders/{order['portal_token']}/submission",
        json=PAYLOAD, headers={'Idempotency-Key': 'manual'})
    assert submitted.status_code == 200
    assert 'ai_assistance_available' not in submitted.json()


@pytest.mark.asyncio
async def test_manual_submission_and_retry_preserve_confirmed_address_and_payment(client, seller_identity):
    order = await _create_test_order(client)
    url = f"/api/public/orders/{order['portal_token']}/submission"
    first = await client.post(url, json=STRUCTURED_PAYLOAD, headers={'Idempotency-Key': 'manual'})
    assert first.status_code == 200, first.text
    retry = await client.post(url, json=STRUCTURED_PAYLOAD, headers={'Idempotency-Key': 'manual'})
    assert retry.status_code == 200
    assert retry.json() == first.json()
    assert first.json()['lifecycle'] == 'pending'
    assert 'ai_assistance_available' not in first.json()

    history = (await client.get(f"/api/seller/orders/{order['id']}/history")).json()
    address = history['items'][0]['address']
    assert address['raw_text'] == STRUCTURED_PAYLOAD['address']['raw_text']
    for field in ('district', 'thana', 'area', 'street_line', 'landmark'):
        assert address[field] == STRUCTURED_PAYLOAD['address'][field]
    assert history['items'][0]['payment_claim']['trx_id'] == PAYLOAD['payment_claim']['trx_id']
