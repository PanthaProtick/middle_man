import pytest

from app.services.evidence_store import inject_storage_outage
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
