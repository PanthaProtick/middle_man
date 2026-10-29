"""Tests for seller changes (delivery correction and cancellation) after courier submission."""
import pytest
from courier_reconciliation_support import offline_consignment
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.fixture(autouse=True)
def offline_settings(monkeypatch):
    from app.core.config import settings
    from app.services.courier_attempts import _memory_attempts
    from app.services.pathao_connections import _memory
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    _memory.clear()
    _memory_attempts.clear()
    yield
    _memory.clear()
    _memory_attempts.clear()


@pytest.mark.usefixtures('seller_identity')
async def test_delivery_correction_after_success_creates_mismatch(client):
    order = await parcel_order(client, 'post-sub-order-1', parcel_weight_grams=1500, parcel_quantity=2)
    await confirm_automatically(client, order, 'SUBMIT-POST-1')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    submitted = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sub-key-post-1'},
    )
    assert submitted.status_code == 200
    sub_res = submitted.json()
    assert sub_res['latest_attempt']['status'] == 'success'
    consignment_id = sub_res['latest_attempt']['consignment_id']
    snapshot = sub_res['latest_attempt']['booking_snapshot']
    assert snapshot['recipient_name'] == 'Parcel Buyer'
    assert snapshot['recipient_phone'] == '01711111111'
    assert sub_res.get('delivery_mismatch') is None

    # Seller updates delivery details after submission
    fresh_order = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    corr_res = await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            'expected_version': fresh_order['version'],
            'reason': 'Customer requested new delivery location and contact',
            'buyer_name': 'Updated Buyer Name',
            'contact_number': '01933333333',
            'address': {'raw_text': 'House 99, Road 11, Banani, Dhaka'},
        },
        headers={'Idempotency-Key': 'corr-post-sub-1'},
    )
    assert corr_res.status_code == 200
    updated_order = corr_res.json()
    assert updated_order['buyer_revision'] > fresh_order['buyer_revision']

    # Read courier review: booking snapshot & consignment remain intact, but delivery mismatch is flagged
    review = (await client.get(review_path)).json()
    assert review['latest_attempt']['status'] == 'success'
    assert review['latest_attempt']['consignment_id'] == consignment_id
    assert review['latest_attempt']['booking_snapshot']['recipient_name'] == 'Parcel Buyer'
    assert review['latest_attempt']['booking_snapshot']['recipient_phone'] == '01711111111'
    assert review['latest_attempt']['booking_snapshot']['recipient_address'] == 'Parcel address, Dhaka'

    # Mismatch information is explicitly exposed
    mismatch = review.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['mismatch'] is True
    assert mismatch['cancelled'] is False
    assert mismatch['recipient_name_changed'] is True
    assert mismatch['contact_number_changed'] is True
    assert mismatch['address_changed'] is True
    assert set(mismatch['changed_fields']) == {'recipient_name', 'contact_number', 'address'}
    assert 'Action required in Pathao' in mismatch['message'] or 'directly in Pathao' in mismatch['message']


@pytest.mark.usefixtures('seller_identity')
async def test_order_cancellation_after_success_creates_mismatch(client):
    order = await parcel_order(client, 'post-sub-order-2', parcel_weight_grams=800, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-POST-2')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    submitted = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sub-key-post-2'},
    )
    assert submitted.status_code == 200
    consignment_id = submitted.json()['latest_attempt']['consignment_id']

    # Seller cancels the order
    fresh_order = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    cancel_res = await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json={
            'action': 'cancel',
            'expected_version': fresh_order['version'],
            'reason': 'Buyer changed their mind',
        },
        headers={'Idempotency-Key': 'cancel-post-sub-2'},
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()['lifecycle'] == 'cancelled'

    # Read review: attempt, consignment, snapshot intact; mismatch flags cancellation
    review = (await client.get(review_path)).json()
    assert review['latest_attempt']['status'] == 'success'
    assert review['latest_attempt']['consignment_id'] == consignment_id
    mismatch = review.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['mismatch'] is True
    assert mismatch['cancelled'] is True
    assert 'cancellation' in mismatch['changed_fields']
    assert 'Pathao' in mismatch['message']


@pytest.mark.usefixtures('seller_identity')
async def test_correction_while_submission_in_flight(client, monkeypatch):
    from app.services import pathao_provider
    order = await parcel_order(client, 'post-sub-order-3', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-POST-3')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    original_submit = pathao_provider.submit_booking

    async def delayed_submit(shop_id, environment, snapshot, credentials=None):
        # While in flight, seller corrects the delivery address
        fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
        await client.patch(
            f"/api/seller/orders/{order['id']}/buyer-details",
            json={
                'expected_version': fresh['version'],
                'reason': 'Correct address during flight',
                'address': {'raw_text': 'Interleaved address 123'},
            },
            headers={'Idempotency-Key': 'corr-in-flight-3'},
        )
        return await original_submit(shop_id, environment, snapshot, credentials)

    monkeypatch.setattr(pathao_provider, 'submit_booking', delayed_submit)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sub-in-flight-3'},
    )
    assert res.status_code == 200
    body = res.json()
    assert body['latest_attempt']['status'] == 'success'
    # The submission response preserves the mismatch notice!
    mismatch = body.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['mismatch'] is True
    assert mismatch['address_changed'] is True
    assert 'address' in mismatch['changed_fields']


@pytest.mark.usefixtures('seller_identity')
async def test_cancellation_while_submission_in_flight(client, monkeypatch):
    from app.services import pathao_provider
    order = await parcel_order(client, 'post-sub-order-4', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-POST-4')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    original_submit = pathao_provider.submit_booking

    async def delayed_submit(shop_id, environment, snapshot, credentials=None):
        fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
        await client.post(
            f"/api/seller/orders/{order['id']}/decisions",
            json={
                'action': 'cancel',
                'expected_version': fresh['version'],
                'reason': 'Cancelled while in flight',
            },
            headers={'Idempotency-Key': 'cancel-in-flight-4'},
        )
        return await original_submit(shop_id, environment, snapshot, credentials)

    monkeypatch.setattr(pathao_provider, 'submit_booking', delayed_submit)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sub-in-flight-4'},
    )
    assert res.status_code == 200
    body = res.json()
    assert body['latest_attempt']['status'] == 'success'
    mismatch = body.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['cancelled'] is True
    assert 'cancellation' in mismatch['changed_fields']


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
async def test_unrelated_edits_do_not_fabricate_mismatch(client):
    order = await parcel_order(client, 'post-sub-order-6', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-POST-6')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    submitted = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sub-key-6'},
    )
    assert submitted.status_code == 200

    # Seller submits an edit that retains identical recipient name, phone, address
    fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    curr_rev = (await client.get(f"/api/seller/orders/{order['id']}/history")).json()['items'][-1]
    patch_res = await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            'expected_version': fresh['version'],
            'reason': 'Audit note only - no recipient change',
            'buyer_name': curr_rev['buyer_name'],
            'contact_number': curr_rev['contact_number'],
            'address': {'raw_text': curr_rev['address']['raw_text']},
        },
        headers={'Idempotency-Key': 'audit-note-only-6'},
    )
    assert patch_res.status_code == 200

    review = (await client.get(review_path)).json()
    assert review.get('delivery_mismatch') is None


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


@pytest.mark.usefixtures('seller_identity')
async def test_correction_before_reservation_invalidates_review(client):
    order = await parcel_order(client, 'post-sub-order-8', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-POST-8')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200
    old_token = ready['token']

    # Delivery correction BEFORE reservation
    fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            'expected_version': fresh['version'],
            'reason': 'Pre-submit correction',
            'buyer_name': 'Brand New Recipient',
        },
        headers={'Idempotency-Key': 'corr-pre-res-8'},
    )

    # Try to submit with old approved token -> Stale version or Review required
    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    stale_sub = await client.post(
        submit_path,
        json={'expected_token': old_token},
        headers={'Idempotency-Key': 'sub-stale-8'},
    )
    assert stale_sub.status_code == 409
    assert stale_sub.json()['error']['code'] in ('STALE_VERSION', 'REVIEW_REQUIRED')

    # Review indicates not approved and submission disabled
    review = (await client.get(review_path)).json()
    assert review['reviewed'] is False
    assert review['submission_enabled'] is False
    assert review.get('latest_attempt') is None
    assert review.get('delivery_mismatch') is None


@pytest.mark.usefixtures('seller_identity')
async def test_cross_shop_denial_and_replay_on_booked_order(client):
    order = await parcel_order(client, 'post-sub-order-9', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-POST-9')
    review_path, ready, _ = await ready_review(client, order)
    approved = await client.post(review_path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    submitted = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'sub-key-9'},
    )
    assert submitted.status_code == 200

    # Cross-shop seller receives 404 on correction and cancellation
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app

    orig_seller_override = app.dependency_overrides.get(get_seller_identity)
    foreign_seller = SellerIdentity(owner_id='foreign-owner-id')
    app.dependency_overrides[get_seller_identity] = lambda: foreign_seller
    try:
        corr_denied = await client.patch(
            f"/api/seller/orders/{order['id']}/buyer-details",
            json={
                'expected_version': 3,
                'reason': 'Cross-shop attempt',
                'buyer_name': 'Hacker',
            },
            headers={'Idempotency-Key': 'hacker-corr-9'},
        )
        assert corr_denied.status_code == 404

        cancel_denied = await client.post(
            f"/api/seller/orders/{order['id']}/decisions",
            json={
                'action': 'cancel',
                'expected_version': 3,
                'reason': 'Cross-shop cancel',
            },
            headers={'Idempotency-Key': 'hacker-cancel-9'},
        )
        assert cancel_denied.status_code == 404

        review_denied = await client.get(review_path)
        assert review_denied.status_code == 404
    finally:
        if orig_seller_override is not None:
            app.dependency_overrides[get_seller_identity] = orig_seller_override
        else:
            app.dependency_overrides.pop(get_seller_identity, None)

    # Same-key replay of correction on the booked order returns identical result
    fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    corr1 = await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            'expected_version': fresh['version'],
            'reason': 'Legit correction',
            'buyer_name': 'Legit Name',
        },
        headers={'Idempotency-Key': 'legit-corr-9'},
    )
    assert corr1.status_code == 200

    corr2 = await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            'expected_version': fresh['version'],
            'reason': 'Legit correction',
            'buyer_name': 'Legit Name',
        },
        headers={'Idempotency-Key': 'legit-corr-9'},
    )
    assert corr2.status_code == 200
    assert corr1.json() == corr2.json()

