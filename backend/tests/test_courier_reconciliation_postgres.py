"""Real PostgreSQL reconciliation persistence, concurrency, and restart recovery."""
import asyncio
import json
from datetime import datetime, timezone
from typing import Any

import pytest
from courier_reconciliation_support import offline_consignment, reconcile, unknown_attempt
from test_courier_drafts import confirm_automatically, parcel_order
from test_courier_review import ready_review


@pytest.fixture(autouse=True)
def postgres_offline_settings(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'SELF_TEST_MODE', False)
    monkeypatch.setattr(settings, 'PATHAO_LOCATION_ENVIRONMENT', 'offline')
    yield


def evidence_value(value: object) -> dict[str, Any]:
    if isinstance(value, str):
        decoded = json.loads(value)
        assert isinstance(decoded, dict)
        return decoded
    assert isinstance(value, dict)
    return value


async def ready_with_existing_connection(client, order):
    path = f"/api/seller/orders/{order['id']}/courier-review"
    current = (await client.get(path)).json()
    payload = {
        'expected_token': current['token'], 'environment': 'offline',
        'store_id': current['stores'][0]['id'], 'delivery_type': 48,
        'location': {'city_id': 1, 'zone_id': 10, 'area_id': 100},
    }
    result = await client.put(path, json=payload)
    assert result.status_code == 200, result.text
    return path, result.json()


def attach_payload(order, attempt, consignment: str) -> dict:
    return {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'consignment_id': consignment,
        'merchant_order_id': order['id'],
    }


async def test_postgres_attach_recovers_and_records_audit(postgres_buyer, monkeypatch):
    client, connection, _, _ = postgres_buyer
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'pg-attach')
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    response = await reconcile(client, order, attach_payload(order, attempt, consignment), 'pg-attach')
    assert response.status_code == 200, response.text
    recovered = response.json()['latest_attempt']
    assert recovered['status'] == 'success'
    assert recovered['resolution_action'] == 'attach_existing'
    assert recovered['resolution_version'] == 1
    assert recovered['booking_snapshot'] == attempt['booking_snapshot']

    row = await connection.fetchrow(
        'SELECT status, consignment_id, resolution_version, resolution_action, resolved_at, booking_snapshot '
        'FROM courier_attempts WHERE id = $1', attempt['id'],
    )
    assert row['status'] == 'success'
    assert row['consignment_id'] == consignment
    assert row['resolution_version'] == 1
    assert row['resolution_action'] == 'attach_existing'
    assert row['resolved_at'] is not None
    assert evidence_value(row['booking_snapshot'])['order_id'] == order['id']

    history = await connection.fetch(
        'SELECT actor, action, resolution_version, resulting_status, environment, consignment_id, '
        'merchant_order_id, evidence FROM courier_reconciliations WHERE attempt_id = $1', attempt['id'],
    )
    assert len(history) == 1
    assert history[0]['actor'] == 'synthetic-postgres'
    assert history[0]['action'] == 'attach_existing'
    assert history[0]['resolution_version'] == 1
    assert history[0]['resulting_status'] == 'success'
    assert history[0]['environment'] == 'offline'
    assert history[0]['consignment_id'] == consignment
    assert history[0]['merchant_order_id'] == order['id']
    assert evidence_value(history[0]['evidence'])['store_id'] == ready['choices']['store_id']
    assert evidence_value(history[0]['evidence'])['prior_error_code'] == 'COURIER_TIMEOUT'
    count = await connection.fetchval('SELECT count(*) FROM courier_attempts WHERE order_id = $1', order['id'])
    assert count == 1

    replay = await reconcile(client, order, attach_payload(order, attempt, consignment), 'pg-attach')
    assert replay.status_code == 200
    assert replay.json() == response.json()
    competing = await reconcile(client, order, attach_payload(order, attempt, consignment), 'pg-attach-new-key')
    assert competing.status_code == 409
    assert competing.json()['error']['code'] == 'ATTEMPT_NOT_RECONCILABLE'


async def test_postgres_confirmed_noncreation_allows_retry(postgres_buyer, monkeypatch):
    client, connection, _, _ = postgres_buyer
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'pg-noncreation')
    response = await reconcile(client, order, {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'confirm_noncreation',
    }, 'pg-noncreation-resolve')
    assert response.status_code == 200, response.text
    assert response.json()['submission_enabled'] is True

    retried = await client.post(
        f"/api/seller/orders/{order['id']}/courier-submission",
        json={'expected_token': ready['token']},
        headers={'Idempotency-Key': 'pg-noncreation-retry'},
    )
    assert retried.status_code == 200, retried.text
    rows = await connection.fetch(
        'SELECT attempt_number, status, error_code, resolution_action FROM courier_attempts '
        'WHERE order_id = $1 ORDER BY attempt_number', order['id'],
    )
    assert len(rows) == 2
    assert rows[0]['status'] == 'failed'
    assert rows[0]['error_code'] == 'CONFIRMED_NONCREATION'
    assert rows[0]['resolution_action'] == 'confirm_noncreation'
    assert rows[1]['status'] == 'success'


async def test_postgres_competing_resolutions_serialize(postgres_buyer, monkeypatch):
    client, connection, _, _ = postgres_buyer
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'pg-competing')
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    attach = attach_payload(order, attempt, consignment)
    noncreation = {'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'confirm_noncreation'}

    first, second = await asyncio.gather(
        reconcile(client, order, attach, 'pg-competing-attach'),
        reconcile(client, order, noncreation, 'pg-competing-noncreation'),
    )
    assert sorted([first.status_code, second.status_code]) == [200, 409]
    losing = second if first.status_code == 200 else first
    assert losing.json()['error']['code'] == 'ATTEMPT_NOT_RECONCILABLE'

    count = await connection.fetchval(
        'SELECT count(*) FROM courier_reconciliations WHERE attempt_id = $1', attempt['id'],
    )
    assert count == 1
    row = await connection.fetchrow('SELECT status FROM courier_attempts WHERE id = $1', attempt['id'])
    assert row['status'] in ('success', 'failed')


async def test_postgres_duplicate_consignment_association_rejected(postgres_buyer, monkeypatch):
    from app.services import pathao_provider

    client, connection, _, _ = postgres_buyer
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'pg-duplicate')
    other = await parcel_order(client, 'pg-duplicate-other', parcel_weight_grams=700, parcel_quantity=1)
    await confirm_automatically(client, other, 'PG-DUPLICATE-OTHER')
    other_path, other_ready = await ready_with_existing_connection(client, other)
    assert (await client.post(other_path, json={'expected_token': other_ready['token']})).status_code == 200
    submitted = await client.post(
        f"/api/seller/orders/{other['id']}/courier-submission",
        json={'expected_token': other_ready['token']},
        headers={'Idempotency-Key': 'pg-duplicate-other-submit'},
    )
    assert submitted.status_code == 200, submitted.text
    shared = submitted.json()['latest_attempt']['consignment_id']

    async def lookup(*args, **kwargs):
        return pathao_provider.CourierBookingEvidence(
            consignment_id=shared, merchant_order_id=order['id'], environment='offline',
            store_id=ready['choices']['store_id'], is_simulated=True,
        )

    monkeypatch.setattr(pathao_provider, 'lookup_booking', lookup)
    response = await reconcile(client, order, {
        'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'consignment_id': shared, 'merchant_order_id': order['id'],
    }, 'pg-duplicate-attach')
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'CONSIGNMENT_ALREADY_ASSOCIATED'
    count = await connection.fetchval(
        'SELECT count(*) FROM courier_reconciliations WHERE attempt_id = $1', attempt['id'],
    )
    assert count == 0


async def test_postgres_stale_version_and_restart_recovery(postgres_buyer, monkeypatch):
    client, connection, _, _ = postgres_buyer
    order = await parcel_order(client, 'pg-restart-reconcile', parcel_weight_grams=900, parcel_quantity=1)
    await confirm_automatically(client, order, 'PG-RESTART-RECONCILE')
    path, ready, _ = await ready_review(client, order)
    assert (await client.post(path, json={'expected_token': ready['token']})).status_code == 200

    now = datetime.now(timezone.utc)
    await connection.execute(
        '''
        INSERT INTO courier_attempts (
            id, order_id, shop_id, attempt_number, environment, status,
            reviewed_token, correlation_id, booking_snapshot, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ''',
        'pg-crashed-reconcile', order['id'], order['shop_id'], 1, 'offline', 'submitting',
        ready['token'], f"{order['id']}-1",
        json.dumps({
            'order_id': order['id'], 'recipient_name': 'Parcel Buyer', 'recipient_phone': '01711111111',
            'recipient_address': 'Parcel address, Dhaka', 'city_id': 1, 'zone_id': 10, 'area_id': 100,
            'store_id': ready['choices']['store_id'], 'delivery_type': 48,
            'item_weight_grams': 900, 'item_quantity': 1,
            'amount_to_collect_bdt': 10000, 'remaining_cod_minor': 1000000,
        }),
        now, now,
    )
    review = (await client.get(path)).json()
    assert review['latest_attempt']['status'] == 'unknown'
    assert review['latest_attempt']['error_code'] == 'INTERRUPTED_IN_FLIGHT'

    stale = await reconcile(client, order, {
        'attempt_id': 'pg-crashed-reconcile', 'expected_version': 1, 'action': 'confirm_noncreation',
    }, 'pg-restart-stale')
    assert stale.status_code == 409
    assert stale.json()['error']['code'] == 'STALE_VERSION'

    resolved = await reconcile(client, order, {
        'attempt_id': 'pg-crashed-reconcile', 'expected_version': 0, 'action': 'confirm_noncreation',
    }, 'pg-restart-resolve')
    assert resolved.status_code == 200, resolved.text
    row = await connection.fetchrow(
        'SELECT status, error_code, resolution_version FROM courier_attempts WHERE id = $1',
        'pg-crashed-reconcile',
    )
    assert row['status'] == 'failed'
    assert row['error_code'] == 'CONFIRMED_NONCREATION'
    assert row['resolution_version'] == 1
    count = await connection.fetchval(
        'SELECT count(*) FROM courier_reconciliations WHERE attempt_id = $1', 'pg-crashed-reconcile',
    )
    assert count == 1
