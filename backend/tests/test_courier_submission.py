"""Submission lifecycle, freshness verification, and idempotency caching."""
import pytest
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review
from test_payment_exceptions import exception_case
from test_payment_exceptions_postgres import decision
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from test_transaction_routes import clean_stores  # noqa: F401


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
async def test_successful_simulated_submission_and_replay(client):
    order = await parcel_order(client, 'submit-order', parcel_weight_grams=1200, parcel_quantity=3)
    await confirm_automatically(client, order, 'SUBMIT-ONE')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200
    assert approved.json()['reviewed'] is True
    assert approved.json()['submission_enabled'] is True

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    submitted = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-submit-1'},
    )
    assert submitted.status_code == 200, submitted.text
    result = submitted.json()
    assert result['reviewed'] is True
    assert result['submission_enabled'] is False
    assert result['latest_attempt'] is not None
    attempt = result['latest_attempt']
    assert attempt['status'] == 'success'
    assert attempt['simulated'] is True
    assert attempt['environment'] == 'offline'
    assert attempt['consignment_id'].startswith('SIM-PATHAO-')
    assert attempt['booking_snapshot'] is not None
    snapshot = attempt['booking_snapshot']
    assert snapshot['recipient_phone'] == '01711111111'
    assert snapshot['item_weight_grams'] == 1200
    assert snapshot['item_quantity'] == 3
    assert snapshot['amount_to_collect_bdt'] == 10000
    assert snapshot['delivery_type'] == 48

    # Same-key replay returns cached identical response
    replay = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-submit-1'},
    )
    assert replay.status_code == 200
    assert replay.json() == result

    # Different idempotency key rejected because order is already booked
    diff_key = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-submit-diff'},
    )
    assert diff_key.status_code == 409
    assert diff_key.json()['error']['code'] in ('ALREADY_BOOKED', 'COURIER_ATTEMPT_PROTECTED')


@pytest.mark.usefixtures('seller_identity')
async def test_zero_cod_collection_for_prepaid_order(client):
    order, receipt = await exception_case(client, 1200000)
    assert (await decision(client, order, receipt)).status_code == 200
    path = f"/api/seller/orders/{order['id']}/courier-review"

    await client.patch(
        path.replace('courier-review', 'courier-draft'),
        json={'expected_version': 1, 'parcel_weight_grams': 500, 'parcel_quantity': 1},
        headers={'Idempotency-Key': 'prepaid-parcel'},
    )
    assert (await client.put('/api/seller/courier/pathao/offline', json={'expected_version': 0})).status_code == 200
    current = (await client.get(path)).json()
    payload = {'expected_token': current['token'], 'environment': 'offline',
               'store_id': current['stores'][0]['id'], 'delivery_type': 48,
               'location': {'city_id': 1, 'zone_id': 10, 'area_id': 100}}
    ready = (await client.put(path, json=payload)).json()
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200
    assert approved.json()['draft']['remaining_cod_minor'] == 0

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    submitted = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-submit-prepaid'},
    )
    assert submitted.status_code == 200
    snapshot = submitted.json()['latest_attempt']['booking_snapshot']
    assert snapshot['amount_to_collect_bdt'] == 0
    assert snapshot['remaining_cod_minor'] == 0


@pytest.mark.usefixtures('seller_identity')
async def test_submission_rejects_stale_review_cancellation_and_unreviewed(client):
    order = await parcel_order(client, 'submit-stale', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-STALE')
    path, ready, _ = await ready_review(client, order)
    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"

    unreviewed = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-unreviewed'},
    )
    assert unreviewed.status_code == 409
    assert unreviewed.json()['error']['code'] == 'REVIEW_REQUIRED'

    await client.post(path, json={'expected_token': ready['token']})

    await client.patch(
        path.replace('courier-review', 'courier-draft'),
        json={'expected_version': ready['draft']['version'], 'parcel_quantity': 2},
        headers={'Idempotency-Key': 'key-edit-parcel'},
    )
    stale = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-stale'},
    )
    assert stale.status_code == 409
    assert stale.json()['error']['code'] == 'STALE_VERSION'


@pytest.mark.usefixtures('seller_identity')
async def test_submission_rejects_sandbox_and_production_environments(client):
    order = await parcel_order(client, 'submit-sandbox', parcel_weight_grams=800, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-ENV')
    path = f"/api/seller/orders/{order['id']}/courier-review"
    current = (await client.get(path)).json()
    selected = await client.put(path, json={
        'expected_token': current['token'],
        'environment': 'sandbox',
        'store_id': 1,
        'delivery_type': 48,
        'location': {'city_id': 1, 'zone_id': 1, 'area_id': 1},
    })
    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': selected.json()['token']},
        headers={'Idempotency-Key': 'key-sandbox'},
    )
    assert res.status_code in (409, 422)
    assert res.json()['error']['code'] in ('REAL_BOOKING_DISABLED', 'COURIER_NOT_READY', 'REVIEW_REQUIRED')


@pytest.mark.usefixtures('seller_identity')
async def test_cancellation_before_submission_rejected(client):
    order = await parcel_order(client, 'submit-cancel', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-CANCEL')
    path, ready, _ = await ready_review(client, order)
    await client.post(path, json={'expected_token': ready['token']})

    current_order = (await client.get(path.replace('/courier-review', ''))).json()
    cancelled = await client.post(
        path.replace('courier-review', 'decisions'),
        json={'action': 'cancel', 'expected_version': current_order['version'], 'reason': 'Stop dispatch'},
        headers={'Idempotency-Key': 'key-cancel-submit'},
    )
    assert cancelled.status_code == 200

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-submit-cancelled'},
    )
    assert res.status_code == 409
    assert res.json()['error']['code'] in ('INVALID_LIFECYCLE', 'STALE_VERSION', 'REVIEW_REQUIRED')


@pytest.mark.usefixtures('seller_identity')
async def test_cross_shop_submission_forbidden(client):
    from app.core.auth import SellerIdentity, get_seller_identity
    from app.main import app

    order = await parcel_order(client, 'submit-cross', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-CROSS')
    path, ready, _ = await ready_review(client, order)
    await client.post(path, json={'expected_token': ready['token']})

    original = app.dependency_overrides[get_seller_identity]
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity('other-seller')
    await client.post('/api/seller/shop', json={'display_name': 'Other Shop'})

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-other-shop'},
    )
    assert res.status_code == 404
    app.dependency_overrides[get_seller_identity] = original
