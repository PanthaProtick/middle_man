"""Real PostgreSQL courier submission persistence, concurrency, and durability acceptance."""
import asyncio

from courier_submission_support import postgres_offline_settings  # noqa: F401
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
