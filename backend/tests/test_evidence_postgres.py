import datetime

import pytest

from app.services.evidence_store import inject_storage_outage
from app.services.raw_evidence_cleanup import get_retention_status, purge_raw_evidence
from tests.test_image_service import _create_minimal_png


@pytest.mark.asyncio
async def test_postgres_evidence_staging_and_attachment(postgres_buyer):
    client, connection, _, order = postgres_buyer

    png_data = _create_minimal_png(width=40, height=30)
    res = await client.post(
        f"/api/public/orders/{order['portal_token']}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "pg-ev-upload"},
    )
    assert res.status_code == 201
    ev_id = res.json()["evidence_id"]

    # Verify record in PostgreSQL table `order_evidence`
    row = await connection.fetchrow("SELECT * FROM order_evidence WHERE id = $1", ev_id)
    assert row is not None
    assert row["shop_id"] == order["shop_id"]
    assert row["order_id"] == order["id"]
    assert row["status"] == "staged"
    assert row["media_type"] == "image/png"
    assert row["width"] == 40
    assert row["height"] == 30
    assert row["byte_size"] > 0
    assert row["deleted_at"] is None

    # Check 30-day deletion deadline
    collected_at = row["collected_at"]
    delete_after = row["delete_after"]
    diff = delete_after - collected_at
    assert abs(diff.total_seconds() - 30 * 86400) < 5

    # Submit order with evidence attached
    sub_payload = {
        "buyer_name": "PG Buyer",
        "contact_number": "01711111111",
        "address": {"raw_text": "Gulshan 1, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "PGTRX12345",
            "sender_number": "01722222222",
            "amount_minor": order["required_advance_minor"],
            "evidence_id": ev_id,
        },
    }
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=sub_payload,
        headers={"Idempotency-Key": "pg-sub-ev"},
    )
    assert sub_res.status_code == 200

    # Evidence status should now be updated to 'attached' in PostgreSQL
    status = await connection.fetchval("SELECT status FROM order_evidence WHERE id = $1", ev_id)
    assert status == "attached"

    # Buyer revision has payment_evidence_id stored
    rev_ev = await connection.fetchval("SELECT payment_evidence_id FROM buyer_revisions WHERE order_id = $1", order["id"])
    assert rev_ev == ev_id


@pytest.mark.asyncio
async def test_postgres_foreign_evidence_rejected_atomically(postgres_buyer):
    client, connection, _, order = postgres_buyer

    # Insert fake evidence bound to a different non-existent order
    fake_ev_id = "00000000-0000-0000-0000-000000000099"
    sub_payload = {
        "buyer_name": "PG Buyer",
        "contact_number": "01711111111",
        "address": {"raw_text": "Gulshan 1, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "PGTRX-FOREIGN",
            "sender_number": "01722222222",
            "amount_minor": order["required_advance_minor"],
            "evidence_id": fake_ev_id,
        },
    }
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=sub_payload,
        headers={"Idempotency-Key": "pg-sub-fake-ev"},
    )
    assert sub_res.status_code == 422
    assert sub_res.json()["error"]["code"] == "EVIDENCE_NOT_FOUND"

    # Verify no buyer revision was inserted
    count = await connection.fetchval("SELECT count(*) FROM buyer_revisions WHERE order_id = $1", order["id"])
    assert count == 0


@pytest.mark.asyncio
async def test_postgres_storage_outage_records_failed_status(postgres_buyer):
    client, connection, _, order = postgres_buyer
    inject_storage_outage(True)
    try:
        res = await client.post(
            f"/api/public/orders/{order['portal_token']}/evidence",
            content=_create_minimal_png(),
            headers={"Content-Type": "image/png", "Idempotency-Key": "pg-outage"},
        )
        assert res.status_code == 503
        failed_count = await connection.fetchval(
            "SELECT count(*) FROM order_evidence WHERE order_id = $1 AND status = 'failed'", order["id"]
        )
        assert failed_count == 1
    finally:
        inject_storage_outage(False)


@pytest.mark.asyncio
async def test_postgres_raw_evidence_cleanup_and_retention_unavailability(postgres_buyer):
    client, connection, sessions, order = postgres_buyer

    png_data = _create_minimal_png(width=30, height=30)
    res = await client.post(
        f"/api/public/orders/{order['portal_token']}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "pg-ev-clean-1"},
    )
    assert res.status_code == 201
    ev_id = res.json()["evidence_id"]

    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "PG Retention Buyer",
            "contact_number": "01711111111",
            "address": {"raw_text": "Gulshan 2, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "PGTRX-RET-1",
                "sender_number": "01722222222",
                "amount_minor": order["required_advance_minor"],
                "evidence_id": ev_id,
            },
        },
        headers={"Idempotency-Key": "pg-sub-ret-1"},
    )
    assert sub_res.status_code == 200

    # Advance delete_after into the past
    await connection.execute(
        "UPDATE order_evidence SET delete_after = NOW() - INTERVAL '1 day' WHERE id = $1",
        ev_id,
    )

    now = datetime.datetime.now(datetime.timezone.utc)
    async with sessions() as db:
        # Check overdue status before cleanup
        status_before = await get_retention_status(db, now, order["shop_id"])
        assert status_before.overdue_count == 1
        assert len(status_before.overdue_items) == 1

        # Purge overdue raw evidence
        cleanup = await purge_raw_evidence(db, now, order["shop_id"])
        assert cleanup.items_purged == 1
        assert cleanup.items_failed == 0

        # Check overdue status after cleanup
        status_after = await get_retention_status(db, now, order["shop_id"])
        assert status_after.overdue_count == 0

    # In database: status is deleted and deleted_at is set
    row = await connection.fetchrow("SELECT * FROM order_evidence WHERE id = $1", ev_id)
    assert row["status"] == "deleted"
    assert row["deleted_at"] is not None

    # Seller evidence retrieval now returns 410 EVIDENCE_UNAVAILABLE
    seller_res = await client.get(f"/api/seller/evidence/{ev_id}")
    assert seller_res.status_code == 410
    assert seller_res.json()["error"]["code"] == "EVIDENCE_UNAVAILABLE"

    # Order lifecycle and buyer revision remain intact
    ord_row = await connection.fetchrow("SELECT lifecycle FROM orders WHERE id = $1", order["id"])
    assert ord_row["lifecycle"] == "pending"


@pytest.mark.asyncio
async def test_postgres_cleanup_storage_outage_safe_repeat_recovery(postgres_buyer):
    client, connection, sessions, order = postgres_buyer

    png_data = _create_minimal_png(width=30, height=30)
    res = await client.post(
        f"/api/public/orders/{order['portal_token']}/evidence",
        content=png_data,
        headers={"Content-Type": "image/png", "Idempotency-Key": "pg-ev-outage-clean"},
    )
    assert res.status_code == 201
    ev_id = res.json()["evidence_id"]

    await connection.execute(
        "UPDATE order_evidence SET delete_after = NOW() - INTERVAL '1 day' WHERE id = $1",
        ev_id,
    )

    now = datetime.datetime.now(datetime.timezone.utc)
    inject_storage_outage(True)
    try:
        async with sessions() as db:
            cleanup_fail = await purge_raw_evidence(db, now, order["shop_id"])
            assert cleanup_fail.items_purged == 0
            assert cleanup_fail.items_failed == 1
            assert cleanup_fail.status == "partial_failure"
    finally:
        inject_storage_outage(False)

    # In database: record was NOT marked deleted
    row = await connection.fetchrow("SELECT * FROM order_evidence WHERE id = $1", ev_id)
    assert row["status"] != "deleted"
    assert row["deleted_at"] is None

    # Retry cleanup after outage recovery
    async with sessions() as db:
        cleanup_retry = await purge_raw_evidence(db, now, order["shop_id"])
        assert cleanup_retry.items_purged == 1
        assert cleanup_retry.items_failed == 0
        assert cleanup_retry.status == "clean"

    row_after = await connection.fetchrow("SELECT * FROM order_evidence WHERE id = $1", ev_id)
    assert row_after["status"] == "deleted"
    assert row_after["deleted_at"] is not None
