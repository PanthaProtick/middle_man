"""Retired image surfaces cannot collect or disclose payment screenshots."""
import copy

import pytest
from buyer_postgres_support import PAYLOAD
from test_public_order_routes import _create_test_order, clean_memory_stores, seller_identity

from app.main import app

__all__ = ['clean_memory_stores', 'seller_identity']


@pytest.mark.asyncio
async def test_removed_routes_are_absent_for_valid_and_unknown_links(client, seller_identity):
    order = await _create_test_order(client)
    for token in (order['portal_token'], 'unknown'):
        for suffix in ('evidence', 'payment-extraction'):
            response = await client.post(f'/api/public/orders/{token}/{suffix}',
                content=b'private-image', headers={'Idempotency-Key': 'retired'})
            assert response.status_code == 404
            assert response.headers['cache-control'] == 'no-store, private'
    assert (await client.get('/api/seller/evidence/old-image')).status_code == 404
    assert not any('evidence/' in path or path.endswith(('/evidence', '/payment-extraction'))
                   for path in app.openapi()['paths'])


@pytest.mark.asyncio
@pytest.mark.parametrize('legacy_value', [None, '', 'old-image'])
async def test_legacy_image_fields_rejected_before_initial_submission(client, seller_identity, legacy_value):
    order = await _create_test_order(client)
    url = f"/api/public/orders/{order['portal_token']}/submission"
    payload = copy.deepcopy(PAYLOAD)
    payload['payment_claim']['evidence_id'] = legacy_value
    assert (await client.post(url, json=payload, headers={'Idempotency-Key': 'manual'})).status_code == 422
    assert (await client.get(url.removesuffix('/submission'))).json()['lifecycle'] == 'awaiting_buyer'
    response = await client.post(url, json=PAYLOAD, headers={'Idempotency-Key': 'manual'})
    assert response.status_code == 200
    assert response.json()['lifecycle'] == 'pending'
    history = (await client.get(f"/api/seller/orders/{order['id']}/history")).json()
    assert 'evidence_id' not in history['items'][0]['payment_claim']
    assert history['items'][0]['payment_claim']['trx_id'] == PAYLOAD['payment_claim']['trx_id']


@pytest.mark.asyncio
async def test_legacy_image_fields_rejected_in_seller_corrections(client, seller_identity):
    order = await _create_test_order(client)
    await client.post(f"/api/public/orders/{order['portal_token']}/submission", json=PAYLOAD,
                      headers={'Idempotency-Key': 'submit'})
    path = f"/api/seller/orders/{order['id']}"
    before = (await client.get(path)).json()
    claim = {**PAYLOAD['payment_claim'], 'evidence_id': 'old-image'}
    response = await client.patch(path + '/buyer-details', json={
        'expected_version': before['version'], 'reason': 'Correct details', 'payment_claim': claim,
    }, headers={'Idempotency-Key': 'correct'})
    assert response.status_code == 422
    assert (await client.get(path)).json() == before
