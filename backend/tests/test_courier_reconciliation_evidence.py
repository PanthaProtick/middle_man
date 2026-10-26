"""Rejected, duplicate, stale, competing, and private reconciliation evidence."""
import json

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
async def test_rejected_or_missing_evidence_keeps_attempt_protected(client, monkeypatch):
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'evidence')
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    base = {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'merchant_order_id': order['id'],
    }
    wrong_consignment = await reconcile(client, order, {**base, 'consignment_id': 'SIM-PATHAO-WRONG'}, 'bad-cid')
    assert wrong_consignment.status_code == 422
    assert wrong_consignment.json()['error']['code'] == 'EVIDENCE_UNAVAILABLE'
    foreign_shop = offline_consignment('another-shop', order['id'], ready['choices']['store_id'])
    foreign = await reconcile(client, order, {**base, 'consignment_id': foreign_shop}, 'foreign-shop-cid')
    assert foreign.status_code == 422
    assert foreign.json()['error']['code'] == 'EVIDENCE_UNAVAILABLE'
    wrong_environment = await reconcile(
        client, order, {**base, 'consignment_id': consignment, 'environment': 'sandbox'}, 'bad-env',
    )
    assert wrong_environment.status_code == 422
    assert wrong_environment.json()['error']['code'] == 'EVIDENCE_MISMATCH'
    wrong_order = await reconcile(
        client, order, {**base, 'consignment_id': consignment, 'merchant_order_id': 'another-order'}, 'bad-order',
    )
    assert wrong_order.status_code == 422
    missing = await reconcile(client, order, {**base, 'consignment_id': None}, 'missing-cid')
    assert missing.status_code == 422
    invalid_noncreation = await reconcile(client, order, {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'confirm_noncreation',
        'consignment_id': consignment,
    }, 'bad-noncreation')
    assert invalid_noncreation.status_code == 422

    current = (await client.get(path)).json()
    assert current['latest_attempt']['status'] == 'unknown'
    assert current['submission_enabled'] is False
    blocked = await client.post(
        f"/api/seller/orders/{order['id']}/courier-submission",
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'still-blocked'},
    )
    assert blocked.status_code == 409
    assert blocked.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'


@pytest.mark.usefixtures('seller_identity')
async def test_duplicate_consignment_association_is_rejected(client, monkeypatch):
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'duplicate')
    from app.services import pathao_provider
    from app.services.courier_attempts import _memory_attempts

    shared = 'SIM-PATHAO-SHARED-0001'
    _memory_attempts.setdefault('other-order', []).append({
        'id': 'other-attempt', 'order_id': 'other-order', 'shop_id': 'other-shop',
        'attempt_number': 1, 'environment': 'offline', 'status': 'success',
        'reviewed_token': 'a' * 64, 'correlation_id': 'other-order-1',
        'consignment_id': shared, 'booking_snapshot': None, 'error_code': None,
        'error_message': None, 'created_at': attempt['created_at'],
        'updated_at': attempt['updated_at'],
    })

    async def lookup(*args, **kwargs):
        return pathao_provider.CourierBookingEvidence(
            consignment_id=shared, merchant_order_id=order['id'], environment='offline',
            store_id=ready['choices']['store_id'], is_simulated=True,
        )

    monkeypatch.setattr(pathao_provider, 'lookup_booking', lookup)
    response = await reconcile(client, order, {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'consignment_id': shared, 'merchant_order_id': order['id'],
    }, 'duplicate-cid')
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'CONSIGNMENT_ALREADY_ASSOCIATED'
    current = (await client.get(path)).json()
    assert current['latest_attempt']['status'] == 'unknown'


@pytest.mark.usefixtures('seller_identity')
async def test_stale_and_competing_resolutions_cannot_bypass_unknown(client, monkeypatch):
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'competing')
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    attach = {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'consignment_id': consignment, 'merchant_order_id': order['id'],
    }

    stale = await reconcile(client, order, {**attach, 'expected_version': 1}, 'stale-resolution')
    assert stale.status_code == 409
    assert stale.json()['error']['code'] == 'STALE_VERSION'

    current_review = (await client.get(path)).json()
    draft_edit = await client.patch(
        f"/api/seller/orders/{order['id']}/courier-draft",
        json={'expected_version': current_review['draft']['version'], 'parcel_weight_grams': 1400},
        headers={'Idempotency-Key': 'unknown-draft-edit'},
    )
    assert draft_edit.status_code == 409
    assert draft_edit.json()['error']['code'] == 'COURIER_ATTEMPT_PROTECTED'
    blocked = await client.post(
        f"/api/seller/orders/{order['id']}/courier-submission",
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'unknown-new-key'},
    )
    assert blocked.status_code == 409
    assert blocked.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'

    settings = await client.patch('/api/seller/courier/pathao/offline', json={
        'expected_version': 1, 'default_store_id': ready['choices']['store_id'], 'default_delivery_type': 12,
    })
    assert settings.status_code == 200, settings.text
    reconnected = await client.put('/api/seller/courier/pathao/offline', json={
        'expected_version': settings.json()['version'],
    })
    assert reconnected.status_code == 200, reconnected.text
    after_settings = (await client.get(path)).json()
    assert after_settings['latest_attempt']['status'] == 'unknown'
    assert after_settings['submission_enabled'] is False
    still_blocked = await client.post(
        f"/api/seller/orders/{order['id']}/courier-submission",
        json={'expected_token': after_settings['token']},
        headers={'Idempotency-Key': 'unknown-after-reconnect'},
    )
    assert still_blocked.status_code == 409
    assert still_blocked.json()['error']['code'] == 'REVIEW_REQUIRED'
    approved = await client.post(
        f"/api/seller/orders/{order['id']}/courier-review",
        json={'expected_token': after_settings['token']},
    )
    assert approved.status_code == 409
    assert approved.json()['error']['code'] == 'COURIER_ATTEMPT_PROTECTED'

    first = await reconcile(client, order, attach, 'winning-resolution')
    assert first.status_code == 200, first.text
    second = await reconcile(client, order, {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'confirm_noncreation',
    }, 'losing-resolution')
    assert second.status_code == 409
    assert second.json()['error']['code'] == 'ATTEMPT_NOT_RECONCILABLE'

    from app.services.courier_reconciliation import _memory_reconciliations
    assert len(_memory_reconciliations[attempt['id']]) == 1


@pytest.mark.usefixtures('seller_identity')
async def test_cross_shop_reconciliation_is_hidden(client, monkeypatch):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app

    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'cross-shop')
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    original = app.dependency_overrides[get_seller_identity]
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('other-seller')
    try:
        await client.post('/api/seller/shop', json={'display_name': 'Other Shop'})
        response = await reconcile(client, order, {
            'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
            'environment': 'offline', 'consignment_id': consignment, 'merchant_order_id': order['id'],
        }, 'cross-shop-resolution')
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_seller_identity] = original


@pytest.mark.usefixtures('seller_identity')
async def test_reconciliation_audit_is_attributable_and_secret_free(client, monkeypatch):
    from app.services import pathao_provider
    from app.services.courier_reconciliation import _memory_reconciliations

    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'audit')
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])

    async def leaky_lookup(*args, **kwargs):
        raise pathao_provider.CourierEvidenceUnavailable(
            'PRIVATE_TOKEN=synthetic-secret 01711111111 House 42'
        )

    with monkeypatch.context() as patch:
        patch.setattr(pathao_provider, 'lookup_booking', leaky_lookup)
        rejected = await reconcile(client, order, {
            'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
            'environment': 'offline', 'consignment_id': consignment, 'merchant_order_id': order['id'],
        }, 'leaky-evidence')
    assert rejected.status_code == 422
    assert 'synthetic-secret' not in rejected.text
    assert '01711111111' not in rejected.text
    assert _memory_reconciliations.get(attempt['id'], []) == []

    resolved = await reconcile(client, order, {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'consignment_id': consignment, 'merchant_order_id': order['id'],
    }, 'safe-evidence')
    assert resolved.status_code == 200
    stored = json.dumps(_memory_reconciliations[attempt['id']], default=str)
    assert 'synthetic-secret' not in stored
    assert 'PRIVATE_TOKEN' not in stored
    assert '01711111111' not in stored
    record = _memory_reconciliations[attempt['id']][0]
    assert set(record['evidence']) == {
        'consignment_id', 'merchant_order_id', 'environment', 'store_id', 'simulated', 'prior_error_code',
    }
