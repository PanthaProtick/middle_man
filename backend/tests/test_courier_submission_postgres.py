"""Real PostgreSQL courier submission persistence, concurrency, and durability acceptance."""
import asyncio

import pytest
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review
from test_courier_submission import (
    test_cancellation_before_submission_rejected as cancel_case,
)
from test_courier_submission import (
    test_successful_simulated_submission_and_replay as success_case,
)
from test_courier_submission import (
    test_zero_cod_collection_for_prepaid_order as prepaid_case,
)
from test_courier_submission_failures import (
    test_definitive_failure_leaves_draft_editable_and_retryable as fail_case,
)
from test_courier_submission_failures import (
    test_unknown_outcome_from_timeout_blocks_resubmission as timeout_case,
)


@pytest.fixture(autouse=True)
def postgres_offline_settings(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    yield


async def test_postgres_submission_success_and_replay(postgres_buyer):
    await success_case(postgres_buyer[0])
    connection = postgres_buyer[1]
    count = await connection.fetchval('SELECT count(*) FROM courier_attempts WHERE status = $1', 'success')
    assert count == 1


async def test_postgres_prepaid_zero_cod(postgres_buyer):
    await prepaid_case(postgres_buyer[0])


async def test_postgres_definitive_failure_retryable(postgres_buyer, monkeypatch):
    await fail_case(postgres_buyer[0], monkeypatch)


async def test_postgres_unknown_timeout_blocks_retry(postgres_buyer, monkeypatch):
    await timeout_case(postgres_buyer[0], monkeypatch)


async def test_postgres_cancellation_ordering(postgres_buyer):
    await cancel_case(postgres_buyer[0])


async def test_postgres_simultaneous_submission_concurrency(postgres_buyer):
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-concur-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-CONCUR-SUBMIT')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"

    # Launch two concurrent submissions
    r1, r2 = await asyncio.gather(
        client.post(submit_path, json={'expected_token': ready['token']}, headers={'Idempotency-Key': 'pg-concurrent-1'}),
        client.post(submit_path, json={'expected_token': ready['token']}, headers={'Idempotency-Key': 'pg-concurrent-2'}),
    )

    statuses = [r1.status_code, r2.status_code]
    assert 200 in statuses
    assert 409 in statuses
    # One succeeds, the other is rejected with conflict
    count = await connection.fetchval('SELECT count(*) FROM courier_attempts WHERE order_id = $1 AND status = $2', order['id'], 'success')
    assert count == 1


async def test_postgres_persistence_failure_leaves_protected_unknown(postgres_buyer, monkeypatch):
    from app.services import courier_attempts
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-pfail-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-PFAIL')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    original_save = courier_attempts.record_outcome

    async def failing_save(db, attempt, outcome, **kwargs):
        if outcome == 'success':
            raise RuntimeError('PostgreSQL connection drop after simulated provider acceptance')
        return await original_save(db, attempt, outcome, **kwargs)

    monkeypatch.setattr(courier_attempts, 'record_outcome', failing_save)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-pg-persist-fail'},
    )
    assert res.status_code in (504, 502, 503)
    review = (await client.get(path)).json()
    assert review['latest_attempt']['status'] == 'unknown'


async def test_postgres_correction_during_reservation(postgres_buyer, monkeypatch):
    from app.services import courier_review
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-corr-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-CORR-SUBMIT')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    original_read = courier_review.read
    corrected = False

    async def hooked_read(db, shop, order_id):
        nonlocal corrected
        result = await original_read(db, shop, order_id)
        if not corrected and order_id == order['id']:
            corrected = True
            patch_res = await client.patch(
                f"/api/seller/orders/{order['id']}/courier-draft",
                json={'expected_version': ready['draft']['version'], 'parcel_weight_grams': 1800},
                headers={'Idempotency-Key': 'corr-during-res'},
            )
            assert patch_res.status_code == 200
        return result

    monkeypatch.setattr(courier_review, 'read', hooked_read)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'pg-submit-corr'},
    )
    assert res.status_code == 409
    assert res.json()['error']['code'] == 'STALE_VERSION'

    count = await connection.fetchval('SELECT count(*) FROM courier_attempts WHERE order_id = $1', order['id'])
    assert count == 0


async def test_postgres_cancellation_during_reservation(postgres_buyer, monkeypatch):
    from app.services import courier_review
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-canc-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-CANC-SUBMIT')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    original_read = courier_review.read
    cancelled = False

    async def hooked_read(db, shop, order_id):
        nonlocal cancelled
        result = await original_read(db, shop, order_id)
        if not cancelled and order_id == order['id']:
            cancelled = True
            current_order = (await client.get(f"/api/seller/orders/{order['id']}")).json()
            dec_res = await client.post(
                f"/api/seller/orders/{order['id']}/decisions",
                json={
                    'action': 'cancel',
                    'expected_version': current_order['version'],
                    'reason': 'Buyer requested order cancellation',
                },
                headers={'Idempotency-Key': 'cancel-during-res'},
            )
            assert dec_res.status_code == 200, dec_res.text
        return result

    monkeypatch.setattr(courier_review, 'read', hooked_read)

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'pg-submit-canc'},
    )
    assert res.status_code == 409
    assert res.json()['error']['code'] == 'INVALID_LIFECYCLE'

    count = await connection.fetchval('SELECT count(*) FROM courier_attempts WHERE order_id = $1', order['id'])
    assert count == 0


async def test_postgres_restart_recovery(postgres_buyer):
    from datetime import datetime, timezone
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-restart-order', parcel_weight_grams=1000, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-RESTART')
    path, ready, _ = await ready_review(client, order)
    approved = await client.post(path, json={'expected_token': ready['token']})
    assert approved.status_code == 200

    now = datetime.now(timezone.utc)
    await connection.execute(
        '''
        INSERT INTO courier_attempts (
            id, order_id, shop_id, attempt_number, environment,
            status, reviewed_token, correlation_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ''',
        'crashed-pg-attempt', order['id'], order['shop_id'], 1, 'offline',
        'submitting', ready['token'], f"{order['id']}-1", now, now,
    )

    review_res = await client.get(path)
    assert review_res.status_code == 200
    review = review_res.json()
    assert review['latest_attempt'] is not None
    assert review['latest_attempt']['status'] == 'unknown'
    assert review['latest_attempt']['error_code'] == 'INTERRUPTED_IN_FLIGHT'

    row = await connection.fetchrow(
        'SELECT status, error_code FROM courier_attempts WHERE id = $1', 'crashed-pg-attempt',
    )
    assert row['status'] == 'unknown'
    assert row['error_code'] == 'INTERRUPTED_IN_FLIGHT'

    submit_path = f"/api/seller/orders/{order['id']}/courier-submission"
    res = await client.post(
        submit_path,
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'key-pg-after-restart'},
    )
    assert res.status_code == 409
    assert res.json()['error']['code'] == 'COURIER_OUTCOME_UNKNOWN'

    blocked_draft = await client.patch(
        f"/api/seller/orders/{order['id']}/courier-draft",
        json={'expected_version': ready['draft']['version'], 'parcel_weight_grams': 1200},
        headers={'Idempotency-Key': 'key-pg-draft-edit-blocked'},
    )
    assert blocked_draft.status_code == 409
    assert blocked_draft.json()['error']['code'] == 'COURIER_ATTEMPT_PROTECTED'


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
