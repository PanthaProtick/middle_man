"""Seller changes preserve unknown-outcome protection and reconciliation notices."""
import pytest
from courier_reconciliation_support import offline_consignment
from courier_submission_support import offline_settings  # noqa: F401
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.usefixtures('seller_identity')
async def test_delayed_reconciliation_preserves_mismatch_notice(client, monkeypatch):
    from app.services import pathao_provider
    order = await parcel_order(client, 'post-sub-order-5', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-POST-5')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    async def timeout_submit(*args, **kwargs):
        raise TimeoutError('Simulated network timeout during provider call')

    monkeypatch.setattr(pathao_provider, 'submit_booking', timeout_submit)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sub-timeout-5'},
    )
    assert res.status_code == 504
    review = (await client.get(review_path)).json()
    attempt = review['latest_attempt']
    assert attempt['status'] == 'unknown'

    # Seller updates address while attempt is unknown
    fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            'expected_version': fresh['version'],
            'reason': 'Buyer changed address after timeout',
            'address': {'raw_text': 'Post-timeout address 456'},
        },
        headers={'Idempotency-Key': 'corr-timeout-5'},
    )

    # Attempt is STILL protected as unknown!
    rev_after_corr = (await client.get(review_path)).json()
    assert rev_after_corr['latest_attempt']['status'] == 'unknown'
    assert rev_after_corr.get('delivery_mismatch') is not None
    assert rev_after_corr['delivery_mismatch']['address_changed'] is True

    # Seller reconciles with attach_existing
    consignment_id = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    reconcile_res = await client.post(
        f"/api/seller/orders/{order['id']}/courier-reconciliation",
        json={
            'attempt_id': attempt['id'],
            'expected_version': attempt['resolution_version'],
            'action': 'attach_existing',
            'environment': 'offline',
            'consignment_id': consignment_id,
            'merchant_order_id': order['id'],
        },
        headers={'Idempotency-Key': 'reconcile-key-5'},
    )
    assert reconcile_res.status_code == 200
    reconciled_review = reconcile_res.json()
    assert reconciled_review['latest_attempt']['status'] == 'success'
    # Mismatch notice is PRESERVED, not erased!
    mismatch = reconciled_review.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['address_changed'] is True


@pytest.mark.usefixtures('seller_identity')
async def test_unknown_attempt_protected_after_correction_and_cancellation(client, monkeypatch):
    from app.services import pathao_provider
    order = await parcel_order(client, 'post-sub-order-7', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-POST-7')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    async def timeout_submit(*args, **kwargs):
        raise TimeoutError('Timeout')

    monkeypatch.setattr(pathao_provider, 'submit_booking', timeout_submit)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sub-timeout-7'},
    )

    # Correct buyer details
    fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            'expected_version': fresh['version'],
            'reason': 'Correct while unknown',
            'buyer_name': 'Changed Recipient',
        },
        headers={'Idempotency-Key': 'corr-unknown-7'},
    )

    # Attempt remains unknown and resubmission is blocked
    review = (await client.get(review_path)).json()
    assert review['latest_attempt']['status'] == 'unknown'
    assert review['submission_enabled'] is False

    resub = await client.post(
        submit_path,
        json={'expected_token': review['token']},
        headers={'Idempotency-Key': 'sub-bypass-7'},
    )
    assert resub.status_code == 409
    assert resub.json()['error']['code'] in ('COURIER_OUTCOME_UNKNOWN', 'REVIEW_REQUIRED')

    # Cancel order while unknown
    fresh2 = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json={
            'action': 'cancel',
            'expected_version': fresh2['version'],
            'reason': 'Cancel while unknown',
        },
        headers={'Idempotency-Key': 'cancel-unknown-7'},
    )

    review2 = (await client.get(review_path)).json()
    assert review2['latest_attempt']['status'] == 'unknown'
    assert review2['submission_enabled'] is False
    assert review2['delivery_mismatch']['cancelled'] is True
