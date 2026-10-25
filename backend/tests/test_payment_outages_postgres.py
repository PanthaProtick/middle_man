"""Database outage rollback, process restart durability, and idempotency replay tests.

Coverage targets: AC37, AC38, AC39.
"""
from typing import Any, Dict

from httpx import Response
from payment_contention_support import order_decision, setup_single_claim_case

from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store
from app.services.transaction_store import reset_transaction_memory_store


async def test_order_decision_synthetic_outage_causes_atomic_rollback(postgres_buyer: Any) -> None:
    """AC39: Database outage near decision commit rolls back atomically; no memory-only confirmation."""
    client, connection, _, _ = postgres_buyer
    order, receipt = await setup_single_claim_case(client, "OUTAGE_1", amount_minor=250000)

    # Attach synthetic failure trigger before commit on idempotency_records
    await connection.execute("""
        CREATE FUNCTION trigger_outage_fail() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'synthetic database outage mid-acceptance';
        END $$;
        CREATE TRIGGER synthetic_outage_trigger BEFORE INSERT ON idempotency_records
        FOR EACH ROW WHEN (NEW.operation = 'order_decision')
        EXECUTE FUNCTION trigger_outage_fail();
    """)
    try:
        # Decision attempt fails with explicit 503 DATABASE_UNAVAILABLE
        failed: Response = await order_decision(client, order, receipt, action="confirm", key="outage-key-1")
        assert failed.status_code == 503, failed.text
        assert failed.json()["error"]["code"] == "DATABASE_UNAVAILABLE"

        # Verify durable database and memory states: complete all-or-nothing rollback
        assert await connection.fetchval("SELECT count(*) FROM allocations") == 0
        assert await connection.fetchval("SELECT count(*) FROM used_payment_markers") == 0

        # Memory store must not have phantom confirmation
        order_fresh: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order['id']}")).json()
        assert order_fresh["lifecycle"] == "pending"
        assert order_fresh["version"] == order["version"]

        receipt_fresh: Dict[str, Any] = (await client.get(f"/api/seller/transactions/{receipt['id']}")).json()
        assert receipt_fresh["allocated_order_id"] is None
    finally:
        await connection.execute("DROP TRIGGER synthetic_outage_trigger ON idempotency_records")
        await connection.execute("DROP FUNCTION trigger_outage_fail()")

    # Subsequent retry after outage recovery succeeds cleanly
    recovered: Response = await order_decision(client, order, receipt, action="confirm", key="outage-key-1")
    assert recovered.status_code == 200, recovered.text
    assert recovered.json()["lifecycle"] == "confirmed"
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 1
    assert await connection.fetchval("SELECT count(*) FROM used_payment_markers") == 1


async def test_order_decision_survives_process_restart_and_replays_idempotently(postgres_buyer: Any) -> None:
    """AC37 & AC39: Succeeded decision survives full process restart, replaying identical 200 with same key."""
    client, connection, _, _ = postgres_buyer
    order, receipt = await setup_single_claim_case(client, "RESTART_1", amount_minor=250000)

    mutation_key: str = "durable-decision-key-1"
    initial_res: Response = await order_decision(client, order, receipt, action="confirm", key=mutation_key)
    assert initial_res.status_code == 200, initial_res.text
    confirmed_order: Dict[str, Any] = initial_res.json()
    assert confirmed_order["lifecycle"] == "confirmed"

    # Simulate process crash/restart: wipe all in-memory stores completely
    reset_order_memory_store()
    reset_memory_store()
    reset_transaction_memory_store()

    # Verify order state was loaded durably from PostgreSQL, not memory
    refetched: Dict[str, Any] = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert refetched["lifecycle"] == "confirmed"
    assert refetched["version"] == confirmed_order["version"]

    # Replaying same mutation key returns the exact same 200 response without new writes (AC37)
    replayed: Response = await order_decision(client, order, receipt, action="confirm", key=mutation_key)
    assert replayed.status_code == 200, replayed.text
    assert replayed.json() == confirmed_order

    # Assert exactly 1 allocation, 1 payment marker, and 1 idempotency record in database
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 1
    assert await connection.fetchval("SELECT count(*) FROM used_payment_markers") == 1
    assert await connection.fetchval(
        "SELECT count(*) FROM idempotency_records WHERE operation='order_decision' AND key LIKE '%' || $1",
        mutation_key,
    ) == 1


async def test_order_decision_key_reuse_different_payload_and_stale_version_rejected(postgres_buyer: Any) -> None:
    """AC38: Same key with different payload returns 409; stale expected version returns 409 without partial writes."""
    client, connection, _, _ = postgres_buyer
    order, receipt = await setup_single_claim_case(client, "REUSE_STALE_1", amount_minor=250000)

    key: str = "conflict-test-key-1"
    first: Response = await order_decision(client, order, receipt, action="confirm", key=key)
    assert first.status_code == 200, first.text

    # 1. Reusing key with a different payload (different reason) returns 409 IDEMPOTENCY_KEY_REUSED
    tampered_payload: Dict[str, Any] = {
        "action": "confirm",
        "expected_version": order["version"],
        "expected_transaction_version": receipt.get("version"),
        "transaction_id": receipt.get("id"),
        "accepted_amount_minor": receipt.get("amount_minor"),
        "reason": "Different reason attempting reuse of key",
    }
    tampered_res: Response = await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json=tampered_payload,
        headers={"Idempotency-Key": key},
    )
    assert tampered_res.status_code == 409, tampered_res.text
    assert tampered_res.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"

    # 2. Stale expected version on a new decision returns 409 STALE_VERSION
    stale_payload: Dict[str, Any] = {
        "action": "cancel",
        "expected_version": order["version"],  # order is now version 3 after confirmation
        "reason": "Late cancel attempt with stale version",
    }
    stale_res: Response = await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json=stale_payload,
        headers={"Idempotency-Key": "new-key-stale-version"},
    )
    assert stale_res.status_code == 409, stale_res.text
    assert stale_res.json()["error"]["code"] == "STALE_VERSION"

    # Verify no partial writes occurred: allocations and markers remain exactly 1
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 1
    assert await connection.fetchval("SELECT count(*) FROM used_payment_markers") == 1
