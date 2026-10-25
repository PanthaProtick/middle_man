import asyncio

import pytest
from buyer_postgres_support import PAYLOAD, wait_for_order_waiters


@pytest.mark.parametrize("same_key", [False, True])
async def test_concurrent_initial_submissions_are_single_use(postgres_buyer, same_key):
    client, connection, _, order = postgres_buyer
    # Force both independent request connections to contend on the same aggregate.
    await connection.execute("BEGIN")
    await connection.execute("SELECT id FROM orders WHERE id=$1 FOR UPDATE", order["id"])
    url = f"/api/public/orders/{order['portal_token']}/submission"
    payload = {**PAYLOAD, "payment_claim": {**PAYLOAD["payment_claim"], "amount_minor": 200000}}
    tasks = [asyncio.create_task(client.post(url, json=payload, headers={"Idempotency-Key": f"race-{0 if same_key else i}"})) for i in range(2)]
    try:
        await wait_for_order_waiters(connection, 2)
    finally:
        await connection.execute("COMMIT")
        responses = await asyncio.gather(*tasks)
    assert sorted(r.status_code for r in responses) == ([200, 200] if same_key else [200, 409])
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 1
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE operation='buyer_submission'") == 1
    if same_key:
        assert responses[0].json() == responses[1].json()


async def test_replay_record_failure_rolls_back_whole_submission(postgres_buyer):
    client, connection, _, order = postgres_buyer
    await connection.execute("""
        CREATE FUNCTION reject_replay() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic replay outage'; END $$;
        CREATE TRIGGER reject_replay BEFORE INSERT ON idempotency_records
        FOR EACH ROW WHEN (NEW.operation='buyer_submission') EXECUTE FUNCTION reject_replay();
    """)
    payload = {**PAYLOAD, "payment_claim": {**PAYLOAD["payment_claim"], "amount_minor": 200000}}
    url = f"/api/public/orders/{order['portal_token']}/submission"
    failed = await client.post(url, json=payload, headers={"Idempotency-Key": "rollback"})
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "DATABASE_UNAVAILABLE"
    assert "synthetic replay outage" not in failed.text
    assert await connection.fetchval("SELECT lifecycle FROM orders") == "awaiting_buyer"
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 0
    assert await connection.fetchval("SELECT count(*) FROM link_measurements WHERE event_type='submission'") == 0
    await connection.execute("DROP TRIGGER reject_replay ON idempotency_records")
    succeeded = await client.post(url, json=payload, headers={"Idempotency-Key": "rollback"})
    assert succeeded.status_code == 200


async def test_submission_replay_survives_new_connections_and_preserves_claim(postgres_buyer):
    client, connection, sessions, order = postgres_buyer
    url = f"/api/public/orders/{order['portal_token']}/submission"
    key = "k" * 64  # Maximum admitted key also exercises bounded persisted composite keys.
    first = await client.post(url, json=PAYLOAD, headers={"Idempotency-Key": key})
    assert first.status_code == 200
    # Discard all pooled application connections and process-memory stores.
    from app.services.order_service import reset_order_memory_store
    from app.services.seller_service import reset_memory_store
    reset_order_memory_store()
    reset_memory_store()
    await sessions.kw["bind"].dispose()
    replay = await client.post(url, json=PAYLOAD, headers={"Idempotency-Key": key})
    assert replay.json() == first.json()
    revision = await connection.fetchrow("SELECT * FROM buyer_revisions")
    assert revision["contact_number_canonical"] == "01711111111"
    assert revision["payment_sender_canonical"] == "01822222222"
    assert revision["payment_amount_minor"] == 3000000000
    assert revision["payment_trx_id"] == "CASE-sensitive"
    status = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert status.json()["lifecycle"] == "pending"
    assert "buyer_name" not in status.json()
    conflict = await client.post(url, json={**PAYLOAD, "buyer_name": "Changed"}, headers={"Idempotency-Key": key})
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 1


async def test_public_read_outage_is_explicit_without_memory_fallback(postgres_buyer):
    client, connection, _, order = postgres_buyer
    await connection.execute("ALTER TABLE orders RENAME TO synthetic_unavailable_orders")
    failed = await client.get(f"/api/public/orders/{order['portal_token']}")
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "DATABASE_UNAVAILABLE"
    assert "synthetic_unavailable_orders" not in failed.text


async def test_invalid_input_leaves_key_and_order_available_for_valid_submission(postgres_buyer):
    client, connection, _, order = postgres_buyer
    url = f"/api/public/orders/{order['portal_token']}/submission"
    headers = {"Idempotency-Key": "correctable"}
    invalid = await client.post(url, json={**PAYLOAD, "contact_number": "invalid"}, headers=headers)
    assert invalid.status_code == 422
    assert await connection.fetchval("SELECT lifecycle FROM orders") == "awaiting_buyer"
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 0
    assert await connection.fetchval("SELECT count(*) FROM idempotency_records WHERE operation='buyer_submission'") == 0
    valid = await client.post(url, json=PAYLOAD, headers=headers)
    assert valid.status_code == 200
    assert valid.json()["lifecycle"] == "pending"
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 1


async def test_buyer_link_cannot_correct_durable_submission(postgres_buyer):
    from app.core.auth import get_seller_identity
    from app.main import app

    client, connection, _, order = postgres_buyer
    submitted = await client.post(f"/api/public/orders/{order['portal_token']}/submission",
                                  json=PAYLOAD, headers={"Idempotency-Key": "initial"})
    assert submitted.status_code == 200
    app.dependency_overrides.pop(get_seller_identity)
    for authorization in ({}, {"Authorization": f"Bearer {order['portal_token']}"}):
        denied = await client.patch(f"/api/seller/orders/{order['id']}/buyer-details",
                                    json={"expected_version": 2, "reason": "Unauthorized edit", "buyer_name": "Changed"},
                                    headers={**authorization, "Idempotency-Key": "buyer-correction"})
        assert denied.status_code == 401
    assert await connection.fetchval("SELECT count(*) FROM buyer_revisions") == 1
    assert await connection.fetchval("SELECT buyer_name FROM buyer_revisions") == PAYLOAD["buyer_name"]
