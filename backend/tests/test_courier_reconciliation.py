"""Seller reconciliation of unknown booking outcomes through the HTTP boundary."""
import pytest
from courier_reconciliation_support import (  # noqa: F401
    offline_consignment,
    offline_settings,
    reconcile,
    unknown_attempt,
)
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401


@pytest.mark.usefixtures('seller_identity')
async def test_attach_existing_consignment_recovers_unknown_attempt(client, monkeypatch):
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'attach')
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    payload = {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'consignment_id': consignment,
        'merchant_order_id': order['id'],
    }

    response = await reconcile(client, order, payload, 'reconcile-attach')
    assert response.status_code == 200, response.text
    review = response.json()
    recovered = review['latest_attempt']
    assert recovered['id'] == attempt['id']
    assert recovered['status'] == 'success'
    assert recovered['consignment_id'] == consignment
    assert recovered['resolution_action'] == 'attach_existing'
    assert recovered['resolution_version'] == 1
    assert recovered['resolved_at'] is not None
    assert recovered['booking_snapshot'] == attempt['booking_snapshot']
    assert review['submission_enabled'] is False

    from app.services.courier_attempts import _memory_attempts
    from app.services.courier_reconciliation import _memory_reconciliations
    assert len(_memory_attempts[order['id']]) == 1
    history = _memory_reconciliations[attempt['id']]
    assert history[0]['actor'] == 'seller_public_test_1'
    assert history[0]['action'] == 'attach_existing'
    assert history[0]['consignment_id'] == consignment
    assert history[0]['resulting_status'] == 'success'

    replay = await reconcile(client, order, payload, 'reconcile-attach')
    assert replay.status_code == 200
    assert replay.json() == review
    competing = await reconcile(client, order, payload, 'reconcile-attach-other-key')
    assert competing.status_code == 409
    assert competing.json()['error']['code'] == 'ATTEMPT_NOT_RECONCILABLE'
    assert len(_memory_reconciliations[attempt['id']]) == 1


@pytest.mark.usefixtures('seller_identity')
async def test_confirmed_noncreation_preserves_attempt_and_reviewed_retry(client, monkeypatch):
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'noncreation')
    payload = {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'confirm_noncreation',
    }
    response = await reconcile(client, order, payload, 'reconcile-noncreation')
    assert response.status_code == 200, response.text
    review = response.json()
    resolved = review['latest_attempt']
    assert resolved['id'] == attempt['id']
    assert resolved['status'] == 'failed'
    assert resolved['error_code'] == 'CONFIRMED_NONCREATION'
    assert resolved['resolution_action'] == 'confirm_noncreation'
    assert resolved['resolution_version'] == 1
    assert resolved['booking_snapshot'] == attempt['booking_snapshot']
    assert review['submission_enabled'] is True

    retried = await client.post(
        f"/api/seller/orders/{order['id']}/courier-submission",
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'noncreation-retry'},
    )
    assert retried.status_code == 200, retried.text
    attempts = (await client.get(path)).json()
    from app.services.courier_attempts import _memory_attempts
    assert len(_memory_attempts[order['id']]) == 2
    assert _memory_attempts[order['id']][0]['status'] == 'failed'
    assert _memory_attempts[order['id']][0]['resolution_action'] == 'confirm_noncreation'
    assert _memory_attempts[order['id']][1]['status'] == 'success'
    assert attempts['latest_attempt']['attempt_number'] == 2


@pytest.mark.usefixtures('seller_identity')
async def test_cancellation_after_noncreation_blocks_retry(client, monkeypatch):
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'cancelled')
    resolved = await reconcile(client, order, {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'confirm_noncreation',
    }, 'noncreation-before-cancel')
    assert resolved.status_code == 200
    assert resolved.json()['submission_enabled'] is True

    current_order = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    cancelled = await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json={'action': 'cancel', 'expected_version': current_order['version'], 'reason': 'Stop dispatch'},
        headers={'Idempotency-Key': 'cancel-after-noncreation'},
    )
    assert cancelled.status_code == 200
    review = (await client.get(path)).json()
    assert 'ORDER_NOT_CONFIRMED' in review['blockers']
    assert review['submission_enabled'] is False
    blocked = await client.post(
        f"/api/seller/orders/{order['id']}/courier-submission",
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'submit-after-cancel'},
    )
    assert blocked.status_code == 409


@pytest.mark.usefixtures('seller_identity')
async def test_cancelled_order_can_still_attach_existing_booking(client, monkeypatch):
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'attach-cancelled')
    current_order = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    cancelled = await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json={'action': 'cancel', 'expected_version': current_order['version'], 'reason': 'Stop dispatch'},
        headers={'Idempotency-Key': 'cancel-before-attach'},
    )
    assert cancelled.status_code == 200
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    response = await reconcile(client, order, {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'consignment_id': consignment, 'merchant_order_id': order['id'],
    }, 'attach-after-cancel')
    assert response.status_code == 200, response.text
    review = response.json()
    assert review['latest_attempt']['status'] == 'success'
    assert review['latest_attempt']['resolution_action'] == 'attach_existing'
    assert 'ORDER_NOT_CONFIRMED' in review['blockers']
