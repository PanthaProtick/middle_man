"""Courier personal-data deletion through the existing retention boundary."""
import datetime as dt

import pytest
from courier_reconciliation_support import offline_settings, reconcile, unknown_attempt  # noqa: F401
from test_public_order_routes import clean_memory_stores, seller_identity  # noqa: F401
from transaction_route_support import clean_stores  # noqa: F401

from app.services.courier_attempts import get_attempts
from app.services.structured_retention import calendar_deadline, purge_completed_orders


async def retention_case(client, monkeypatch, db=None):
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'retention')
    current = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    deadline = calendar_deadline(dt.datetime.fromisoformat(current['completed_at']))
    assert (await purge_completed_orders(db, deadline - dt.timedelta(microseconds=1), order['shop_id'])).removed == 0
    assert (await get_attempts(db, order['id']))[0].booking_snapshot is not None
    assert (await purge_completed_orders(db, deadline, order['shop_id'])).removed == 1
    retained = (await get_attempts(db, order['id']))[0]
    assert retained.status == 'unknown'
    assert retained.id == attempt['id']
    assert retained.booking_snapshot is None
    assert retained.error_message is None
    assert retained.error_code is None
    assert retained.reviewed_token == ''
    for url in (path, path.replace('courier-review', 'courier-draft'),
                f"/api/public/orders/{order['portal_token']}"):
        response = await client.get(url)
        assert response.status_code == 410, response.text
        assert response.json()['error']['code'] == 'RECORD_UNAVAILABLE'
    response = await client.post(path.replace('courier-review', 'courier-submission'),
        json={'expected_token': ready['token']}, headers={'Idempotency-Key': 'retention-new'})
    assert response.status_code == 410, response.text
    assert (await reconcile(client, order, {'attempt_id': attempt['id'], 'expected_version': 0,
        'action': 'confirm_noncreation'}, 'retention-resolve')).status_code == 410
    assert (await purge_completed_orders(db, deadline, order['shop_id'])).removed == 0
    return order, attempt, deadline


@pytest.mark.usefixtures('seller_identity')
async def test_offline_unknown_attempt_is_redacted_but_stays_protected(client, monkeypatch):
    await retention_case(client, monkeypatch)


async def test_postgres_unknown_attempt_is_redacted_after_restart(postgres_buyer, monkeypatch):
    client, connection, sessions, _ = postgres_buyer
    async with sessions() as db:
        order, attempt, deadline = await retention_case(client, monkeypatch, db)
    async with sessions() as restarted:
        retained = (await get_attempts(restarted, order['id']))[0]
        assert retained.status == 'unknown' and retained.booking_snapshot is None
        assert (await purge_completed_orders(restarted, deadline, order['shop_id'])).removed == 0
    assert await connection.fetchval('SELECT count(*) FROM courier_drafts WHERE order_id=$1', order['id']) == 0
    assert await connection.fetchval("SELECT booking_snapshot = 'null'::jsonb FROM courier_attempts WHERE id=$1", attempt['id'])


@pytest.mark.parametrize('resolved', [False, True])
async def test_postgres_erases_resolution_and_replays_preserving_association(postgres_buyer, monkeypatch, resolved):
    from courier_reconciliation_support import offline_consignment

    from app.core.idempotency import save_idempotency_record

    client, connection, sessions, _ = postgres_buyer
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'resolution-retention')
    consignment = offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])
    payload = {'attempt_id': attempt['id'], 'expected_version': 0, 'action': 'attach_existing',
        'environment': 'offline', 'merchant_order_id': order['id'], 'consignment_id': consignment}
    if resolved:
        result = await reconcile(client, order, payload, 'resolution-erased')
        assert result.status_code == 200, result.text
        # Simulate historical provider/audit text, including data absent from current views.
        await connection.execute("UPDATE courier_reconciliations SET actor='Private Actor', evidence=$1::jsonb WHERE order_id=$2",
            '{"raw_response":"Private delivery detail"}', order['id'])
    current = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    deadline = calendar_deadline(dt.datetime.fromisoformat(current['completed_at']))
    settings_before = await connection.fetch('SELECT * FROM pathao_connection_revisions')
    async with sessions() as db:
        await save_idempotency_record(db, 'pending-erased', 'synthetic', 'courier_reconciliation',
            'private-hash', 200, {'committed_resolution': attempt['id']})
        # A different shop must not erase any part of the original courier records.
        assert (await purge_completed_orders(db, deadline, 'another-shop')).removed == 0
        assert (await get_attempts(db, order['id']))[0].booking_snapshot is not None
        assert (await purge_completed_orders(db, deadline, order['shop_id'])).removed == 1
    async with sessions() as restarted:
        retained = (await get_attempts(restarted, order['id']))[0]
        assert retained.status == ('success' if resolved else 'unknown')
        assert retained.consignment_id == (consignment if resolved else None)
        assert retained.booking_snapshot is None
    assert await connection.fetchval('SELECT count(*) FROM courier_reconciliations WHERE order_id=$1', order['id']) == 0
    receipt = await connection.fetchrow("SELECT response_json,payload_hash FROM idempotency_records WHERE scope='synthetic'")
    assert receipt['response_json'] == '{"record_unavailable": true}'
    assert receipt['payload_hash'] == ''
    assert await connection.fetch('SELECT * FROM pathao_connection_revisions') == settings_before
    assert (await reconcile(client, order, payload, 'resolution-erased')).status_code == 410
    assert (await client.get(path)).status_code == 410
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE response_json LIKE '%Parcel Buyer%'") == 0


async def test_postgres_courier_failure_rolls_back_then_retry_erases(postgres_buyer, monkeypatch):
    client, connection, sessions, _ = postgres_buyer
    order, _, _, _ = await unknown_attempt(client, monkeypatch, 'rollback-retention')
    current = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    deadline = calendar_deadline(dt.datetime.fromisoformat(current['completed_at']))
    await connection.execute("""CREATE FUNCTION fail_courier_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'private provider response'; END $$;
        CREATE TRIGGER block_cleanup BEFORE UPDATE ON courier_attempts
        FOR EACH ROW EXECUTE FUNCTION fail_courier_cleanup();""")
    async with sessions() as db:
        status = await purge_completed_orders(db, deadline, order['shop_id'])
        assert status.failed == status.overdue == 1
        assert status.removed == 0
    assert await connection.fetchval('SELECT retention_error FROM orders WHERE id=$1', order['id']) == 'STRUCTURED_CLEANUP_FAILED'
    async with sessions() as restarted:
        assert (await get_attempts(restarted, order['id']))[0].booking_snapshot is not None
    await connection.execute('DROP TRIGGER block_cleanup ON courier_attempts; DROP FUNCTION fail_courier_cleanup()')
    async with sessions() as db:
        status = await purge_completed_orders(db, deadline, order['shop_id'])
        assert status.removed == 1 and status.failed == 0


async def test_postgres_cleanup_during_provider_lookup_cannot_restore_resolution(postgres_buyer, monkeypatch):
    from courier_reconciliation_support import offline_consignment

    from app.services import pathao_provider

    client, connection, sessions, _ = postgres_buyer
    order, path, ready, attempt = await unknown_attempt(client, monkeypatch, 'race-retention')
    current = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    deadline = calendar_deadline(dt.datetime.fromisoformat(current['completed_at']))
    lookup = pathao_provider.lookup_booking

    async def lookup_after_cleanup(*args, **kwargs):
        evidence = await lookup(*args, **kwargs)
        async with sessions() as db:
            assert (await purge_completed_orders(db, deadline, order['shop_id'])).removed == 1
        return evidence

    monkeypatch.setattr(pathao_provider, 'lookup_booking', lookup_after_cleanup)
    result = await reconcile(client, order, {'attempt_id': attempt['id'], 'expected_version': 0,
        'action': 'attach_existing', 'environment': 'offline', 'merchant_order_id': order['id'],
        'consignment_id': offline_consignment(order['shop_id'], order['id'], ready['choices']['store_id'])}, 'racing-resolution')
    assert result.status_code == 410, result.text
    assert await connection.fetchval('SELECT count(*) FROM courier_reconciliations WHERE order_id=$1', order['id']) == 0
    async with sessions() as db:
        retained = (await get_attempts(db, order['id']))[0]
        assert retained.status == 'unknown' and retained.booking_snapshot is None
    assert (await client.get(path)).status_code == 410
