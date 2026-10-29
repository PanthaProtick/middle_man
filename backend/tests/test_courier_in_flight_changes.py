"""Delivery correction and cancellation while courier submission is in flight."""
import pytest
from courier_submission_support import offline_settings  # noqa: F401
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


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
