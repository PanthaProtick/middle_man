"""PostgreSQL delivery corrections and cancellation after or during submission."""

from courier_submission_support import postgres_offline_settings  # noqa: F401
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review


async def test_postgres_correction_after_success_creates_mismatch(postgres_buyer):
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-post-corr-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-POST-CORR')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'pg-post-corr-sub'},
    )
    assert res.status_code == 200
    consignment_id = res.json()['latest_attempt']['consignment_id']

    fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    corr_res = await client.patch(
        f"/api/seller/orders/{order['id']}/buyer-details",
        json={
            'expected_version': fresh['version'],
            'reason': 'Postgres correction',
            'buyer_name': 'Postgres New Name',
            'contact_number': '01855555555',
            'address': {'raw_text': 'Postgres New Address'},
        },
        headers={'Idempotency-Key': 'pg-corr-post-sub'},
    )
    assert corr_res.status_code == 200

    review = (await client.get(path)).json()
    assert review['latest_attempt']['status'] == 'success'
    assert review['latest_attempt']['consignment_id'] == consignment_id
    mismatch = review.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['mismatch'] is True
    assert mismatch['recipient_name_changed'] is True
    assert mismatch['contact_number_changed'] is True
    assert mismatch['address_changed'] is True


async def test_postgres_cancellation_after_success_creates_mismatch(postgres_buyer):
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-post-canc-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-POST-CANC')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'pg-post-canc-sub'},
    )
    assert res.status_code == 200

    fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    cancel_res = await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json={
            'action': 'cancel',
            'expected_version': fresh['version'],
            'reason': 'Postgres cancellation',
        },
        headers={'Idempotency-Key': 'pg-canc-post-sub'},
    )
    assert cancel_res.status_code == 200

    review = (await client.get(path)).json()
    assert review['latest_attempt']['status'] == 'success'
    mismatch = review.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['cancelled'] is True
    assert 'cancellation' in mismatch['changed_fields']


async def test_postgres_correction_while_submission_in_flight(postgres_buyer, monkeypatch):
    from app.services import pathao_provider
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-inflight-corr-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-INFLIGHT-CORR')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    original_submit = pathao_provider.submit_booking

    async def hooked_submit(shop_id, environment, snapshot, credentials=None):
        fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
        patch_res = await client.patch(
            f"/api/seller/orders/{order['id']}/buyer-details",
            json={
                'expected_version': fresh['version'],
                'reason': 'In-flight delivery correction under Postgres',
                'buyer_name': 'Inflight Postgres Buyer',
            },
            headers={'Idempotency-Key': 'pg-corr-inflight-key'},
        )
        assert patch_res.status_code == 200
        return await original_submit(shop_id, environment, snapshot, credentials)

    monkeypatch.setattr(pathao_provider, 'submit_booking', hooked_submit)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'pg-inflight-corr-sub'},
    )
    assert res.status_code == 200
    body = res.json()
    assert body['latest_attempt']['status'] == 'success'
    mismatch = body.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['recipient_name_changed'] is True


async def test_postgres_cancellation_while_submission_in_flight(postgres_buyer, monkeypatch):
    from app.services import pathao_provider
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-inflight-canc-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-INFLIGHT-CANC')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    original_submit = pathao_provider.submit_booking

    async def hooked_submit(shop_id, environment, snapshot, credentials=None):
        fresh = (await client.get(f"/api/seller/orders/{order['id']}")).json()
        cancel_res = await client.post(
            f"/api/seller/orders/{order['id']}/decisions",
            json={
                'action': 'cancel',
                'expected_version': fresh['version'],
                'reason': 'In-flight cancellation under Postgres',
            },
            headers={'Idempotency-Key': 'pg-cancel-inflight-key'},
        )
        assert cancel_res.status_code == 200
        return await original_submit(shop_id, environment, snapshot, credentials)

    monkeypatch.setattr(pathao_provider, 'submit_booking', hooked_submit)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'pg-inflight-canc-sub'},
    )
    assert res.status_code == 200
    body = res.json()
    assert body['latest_attempt']['status'] == 'success'
    mismatch = body.get('delivery_mismatch')
    assert mismatch is not None
    assert mismatch['cancelled'] is True
