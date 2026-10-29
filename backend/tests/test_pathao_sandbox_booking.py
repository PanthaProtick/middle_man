"""Mocked sandbox booking checks; never calls a live provider."""
import json

import httpx
import pytest
from pathao_sandbox_support import (
    CONSIGNMENT,
    CREDENTIALS,
    create_calls,
    provider_router,
    sandbox_credentials,
    sandbox_review,
    sandbox_settings,  # noqa: F401
)
from test_courier_drafts import confirm_automatically, parcel_order
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.usefixtures('seller_identity')
async def test_sandbox_submission_sends_exact_server_facts_and_records_consignment(client, monkeypatch):
    order, path, ready, calls = await sandbox_review(client, monkeypatch, 'sandbox-ok')
    submit = f"/api/seller/orders/{order['id']}/courier-submission"
    response = await client.post(
        submit, json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sandbox-submit-one'},
    )
    assert response.status_code == 200, response.text
    attempt = response.json()['latest_attempt']
    assert attempt['status'] == 'success'
    assert attempt['environment'] == 'sandbox'
    assert attempt['simulated'] is False
    assert attempt['consignment_id'] == CONSIGNMENT
    assert attempt['booking_snapshot']['connection_version'] == 1
    assert attempt['booking_snapshot']['amount_to_collect_bdt'] == 10000

    creates = create_calls(calls)
    assert len(creates) == 1
    payload = json.loads(creates[0].content)
    assert payload == {
        'store_id': 321, 'merchant_order_id': order['id'],
        'recipient_name': 'Parcel Buyer', 'recipient_phone': '01711111111',
        'recipient_address': 'Parcel address, Dhaka',
        'recipient_city': 1, 'recipient_zone': 10, 'recipient_area': 100,
        'delivery_type': 48, 'item_type': 2, 'item_quantity': 3,
        'item_weight': 1.2, 'amount_to_collect': 10000,
    }
    assert 'sandbox-secret' not in response.text and 'sandbox-password' not in response.text

    replay = await client.post(
        submit, json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sandbox-submit-one'},
    )
    assert replay.status_code == 200
    assert replay.json() == response.json()
    assert len(create_calls(calls)) == 1


@pytest.mark.usefixtures('seller_identity')
async def test_sandbox_timeout_stays_unknown_and_verified_consignment_recovers(client, monkeypatch):
    order, path, ready, _ = await sandbox_review(client, monkeypatch, 'sandbox-unknown')

    def timeout():
        raise httpx.ReadTimeout('synthetic sandbox timeout')

    def verified_lookup():
        return httpx.Response(200, json={
            'type': 'success', 'code': 200, 'message': 'Order info',
            'data': {'consignment_id': CONSIGNMENT, 'merchant_order_id': order['id'],
                     'store_id': 321, 'order_status': 'Pending'},
        })

    calls = provider_router(monkeypatch, create=timeout, lookup=verified_lookup)
    submit = f"/api/seller/orders/{order['id']}/courier-submission"
    response = await client.post(
        submit, json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sandbox-timeout'},
    )
    assert response.status_code == 504
    assert response.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'
    current = (await client.get(path)).json()
    assert current['latest_attempt']['status'] == 'unknown'
    assert current['submission_enabled'] is False

    reconcile = await client.post(
        f"/api/seller/orders/{order['id']}/courier-reconciliation",
        json={
            'attempt_id': current['latest_attempt']['id'], 'expected_version': 0,
            'action': 'attach_existing', 'environment': 'sandbox',
            'consignment_id': CONSIGNMENT, 'merchant_order_id': order['id'],
        },
        headers={'Idempotency-Key': 'sandbox-attach'},
    )
    assert reconcile.status_code == 200, reconcile.text
    recovered = reconcile.json()['latest_attempt']
    assert recovered['status'] == 'success'
    assert recovered['consignment_id'] == CONSIGNMENT
    assert recovered['resolution_action'] == 'attach_existing'
    assert len([call for call in calls if call.url.path.endswith('/info')]) == 1


@pytest.mark.usefixtures('seller_identity')
async def test_production_submission_remains_disabled(client, monkeypatch):
    calls = provider_router(monkeypatch)
    await client.post('/api/seller/shop', json={'display_name': 'Production shop'})
    connected = await client.put('/api/seller/courier/pathao/production',
                                 json={'expected_version': 0, 'credentials': CREDENTIALS})
    assert connected.status_code == 200, connected.text
    order = await parcel_order(client, 'production-disabled', parcel_weight_grams=1200, parcel_quantity=1)
    await confirm_automatically(client, order, 'PRODUCTION-DISABLED')
    path = f"/api/seller/orders/{order['id']}/courier-review"
    current = (await client.get(path)).json()
    selected = await client.put(path, json={
        'expected_token': current['token'], 'environment': 'production',
        'store_id': 321, 'delivery_type': 48,
        'location': {'city_id': 1, 'zone_id': 10, 'area_id': 100},
    })
    assert selected.status_code == 200, selected.text
    approved = await client.post(path, json={'expected_token': selected.json()['token']})
    assert approved.status_code == 200, approved.text
    assert approved.json()['submission_enabled'] is False
    response = await client.post(
        f"/api/seller/orders/{order['id']}/courier-submission",
        json={'expected_token': selected.json()['token']},
        headers={'Idempotency-Key': 'production-submit'},
    )
    assert response.status_code == 422
    assert response.json()['error']['code'] == 'REAL_BOOKING_DISABLED'
    assert create_calls(calls) == []


async def test_sandbox_credentials_require_the_reviewed_connection_revision(monkeypatch):
    from app.services import pathao_connections

    calls = provider_router(monkeypatch)
    pathao_connections._memory.clear()
    first = await pathao_connections.connect(None, 'shop-rotation', 'sandbox', pathao_connections.ConnectInput(
        expected_version=0, credentials=sandbox_credentials(),
    ))
    await pathao_connections.connect(None, 'shop-rotation', 'sandbox', pathao_connections.ConnectInput(
        expected_version=first.version, credentials=sandbox_credentials(),
    ))
    with pytest.raises(pathao_connections.CourierSetupError) as caught:
        await pathao_connections.submission_credentials(None, 'shop-rotation', 'sandbox', first.version)
    assert caught.value.status_code == 409
    assert caught.value.code == 'COURIER_SETUP_CHANGED'
    assert create_calls(calls) == []

    with pytest.raises(pathao_connections.CourierSetupError) as missing:
        await pathao_connections.submission_credentials(None, 'shop-rotation', 'sandbox', 99)
    assert missing.value.code == 'COURIER_SETUP_CHANGED'

    with pytest.raises(pathao_connections.CourierSetupError) as absent:
        await pathao_connections.submission_credentials(None, 'shop-missing', 'sandbox', 1)
    assert absent.value.status_code == 422
    assert absent.value.code == 'COURIER_CONNECTION_REQUIRED'
