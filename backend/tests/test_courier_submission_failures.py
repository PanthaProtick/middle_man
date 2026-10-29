"""Definitive rejections, unknown outcomes, boundary validations, and recovery."""
import pytest
from courier_submission_support import offline_settings  # noqa: F401
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('locale', ['en', 'bn'])
async def test_definitive_failure_leaves_draft_editable_and_retryable(client, monkeypatch, locale):
    from app.services import pathao_provider

    client.headers['Accept-Language'] = locale
    order = await parcel_order(client, 'submit-fail', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-FAIL')
    path, ready, _ = await ready_review(client, order)
    await client.post(path, json={'expected_token': ready['token']})

    async def fail_booking(*args, **kwargs):
        from app.services.pathao_provider import CourierDefinitiveFailure
        raise CourierDefinitiveFailure('Store is inactive or unserviceable.')

    monkeypatch.setattr(pathao_provider, 'submit_booking', fail_booking)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-fail-1'},
    )
    assert res.status_code == 422
    assert res.json()['error']['code'] == 'COURIER_REJECTED'

    review = (await client.get(path)).json()
    assert review['latest_attempt'] is not None
    assert review['latest_attempt']['status'] == 'failed'
    assert review['latest_attempt']['error_code'] == 'COURIER_REJECTED'
    client.headers['Accept-Language'] = 'bn' if locale == 'en' else 'en'
    assert (await client.get(path)).json() == review

    patched = await client.patch(
        path.replace('courier-review', 'courier-draft'),
        json={'expected_version': review['draft']['version'], 'parcel_weight_grams': 1500},
        headers={'Idempotency-Key': 'key-edit-after-fail'},
    )
    assert patched.status_code == 200


@pytest.mark.usefixtures('seller_identity')
@pytest.mark.parametrize('locale', ['en', 'bn'])
async def test_unknown_outcome_from_timeout_blocks_resubmission(client, monkeypatch, locale):
    from app.services import pathao_provider

    client.headers['Accept-Language'] = locale
    order = await parcel_order(client, 'submit-timeout', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-TIMEOUT')
    path, ready, _ = await ready_review(client, order)
    await client.post(path, json={'expected_token': ready['token']})

    calls = 0

    async def timeout_booking(*args, **kwargs):
        nonlocal calls
        calls += 1
        raise TimeoutError('Connection to courier timed out.')

    monkeypatch.setattr(pathao_provider, 'submit_booking', timeout_booking)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-timeout-1'},
    )
    assert res.status_code in (504, 502, 503)
    assert res.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'

    review = (await client.get(path)).json()
    assert review['latest_attempt'] is not None
    assert review['latest_attempt']['status'] == 'unknown'
    assert review['submission_enabled'] is False
    assert review['latest_attempt']['error_code'] == 'COURIER_TIMEOUT'
    client.headers['Accept-Language'] = 'bn' if locale == 'en' else 'en'
    assert (await client.get(path)).json() == review
    replay = await client.post(
        submit_path, json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-timeout-1'},
    )
    assert replay.status_code == 409
    assert replay.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'
    assert (await client.get(path)).json() == review

    blocked = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-timeout-2'},
    )
    assert blocked.status_code == 409
    assert blocked.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'
    assert calls == 1


@pytest.mark.usefixtures('seller_identity')
async def test_persistence_failure_after_provider_acceptance_classified_as_unknown(client, monkeypatch):
    from app.services import courier_attempts

    order = await parcel_order(client, 'submit-persist-fail', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-PFAIL')
    path, ready, _ = await ready_review(client, order)
    await client.post(path, json={'expected_token': ready['token']})

    original_save = courier_attempts.record_outcome

    async def failing_save(db, attempt, outcome, **kwargs):
        if outcome == 'success':
            raise RuntimeError('Simulated database write failure after provider acceptance')
        return await original_save(db, attempt, outcome, **kwargs)

    monkeypatch.setattr(courier_attempts, 'record_outcome', failing_save)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-persist-fail'},
    )
    assert res.status_code in (504, 502, 503)
    assert res.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'

    review = (await client.get(path)).json()
    assert review['latest_attempt']['status'] == 'unknown'


@pytest.mark.usefixtures('seller_identity')
async def test_restart_recovers_in_flight_submitting_as_unknown(client):
    order = await parcel_order(client, 'submit-restart', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'SUBMIT-RESTART')
    path, ready, _ = await ready_review(client, order)
    await client.post(path, json={'expected_token': ready['token']})

    from app.services.courier_attempts import _memory_attempts
    _memory_attempts[order['id']] = [{
        'id': 'crashed-attempt',
        'order_id': order['id'],
        'shop_id': 'shop-1',
        'attempt_number': 1,
        'environment': 'offline',
        'status': 'submitting',
        'reviewed_token': ready['token'],
        'correlation_id': f"{order['id']}-1",
        'consignment_id': None,
        'booking_snapshot': None,
        'error_code': None,
        'error_message': None,
        'created_at': ready['draft']['created_at'],
        'updated_at': ready['draft']['created_at'],
    }]

    review = (await client.get(path)).json()
    assert review['latest_attempt'] is not None
    assert review['latest_attempt']['status'] == 'unknown'
    assert review['submission_enabled'] is False

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-after-restart'},
    )
    assert res.status_code == 409
    assert res.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'
