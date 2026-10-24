"""Real PostgreSQL boundary and concurrency tests for cancellation, rejection and replacement."""

import asyncio
import json

from buyer_postgres_support import wait_for_order_waiters
from test_payment_exceptions import exception_case


async def test_postgres_cancellation_and_rejection_durability(postgres_buyer):
    client, connection, _, order = postgres_buyer
    path = f"/api/seller/orders/{order['id']}"

    # Cancel awaiting_buyer order
    cancel_res = await client.post(
        path + "/decisions",
        json={
            "action": "cancel",
            "expected_version": order["version"],
            "reason": "Real postgres cancellation",
        },
        headers={"Idempotency-Key": "pg-cancel-1"},
    )
    assert cancel_res.status_code == 200, cancel_res.text
    cancelled = cancel_res.json()
    assert cancelled["lifecycle"] == "cancelled"

    # Verify durability in database directly
    row = await connection.fetchrow("SELECT lifecycle, version, completed_at FROM orders WHERE id = $1", order["id"])
    assert row["lifecycle"] == "cancelled"
    assert row["version"] == 2
    assert row["completed_at"] is not None

    audit_row = await connection.fetchrow(
        "SELECT action, details FROM audit_events WHERE aggregate_id = $1 AND action = 'order_cancelled'",
        order["id"],
    )
    assert audit_row is not None
    assert json.loads(audit_row["details"])["reason"] == "Real postgres cancellation"


async def test_postgres_replacement_atomicity_and_links(postgres_buyer):
    client, connection, _, order = postgres_buyer
    path = f"/api/seller/orders/{order['id']}"

    replace_res = await client.post(
        path + "/replacement",
        json={
            "expected_version": order["version"],
            "reason": "Real postgres replacement",
            "order": {
                "product_name": "Postgres Replacement Product",
                "total_minor": 1300000,
                "required_advance_minor": 250000,
                "payment_account_id": order["payment_account_id"],
            },
        },
        headers={"Idempotency-Key": "pg-replace-1"},
    )
    assert replace_res.status_code == 201, replace_res.text
    new_order = replace_res.json()

    # Verify database relationships
    pred_row = await connection.fetchrow(
        "SELECT lifecycle, replaced_by_order_id, version FROM orders WHERE id = $1", order["id"]
    )
    assert pred_row["lifecycle"] == "cancelled"
    assert pred_row["replaced_by_order_id"] == new_order["id"]
    assert pred_row["version"] == 2

    new_row = await connection.fetchrow(
        "SELECT lifecycle, predecessor_order_id, version, product_name FROM orders WHERE id = $1", new_order["id"]
    )
    assert new_row["lifecycle"] == "awaiting_buyer"
    assert new_row["predecessor_order_id"] == order["id"]
    assert new_row["version"] == 1
    assert new_row["product_name"] == "Postgres Replacement Product"


async def test_postgres_replacement_versus_confirmation_contention(postgres_buyer):
    client, connection, _, _ = postgres_buyer
    order, receipt = await exception_case(client, 200000)
    path = f"/api/seller/orders/{order['id']}"

    async def do_confirm():
        return await client.post(
            path + "/decisions",
            json={
                "action": "confirm",
                "expected_version": order["version"],
                "expected_transaction_version": receipt["version"],
                "transaction_id": receipt["id"],
                "accepted_amount_minor": 200000,
                "reason": "Accept advance in race",
            },
            headers={"Idempotency-Key": "race-confirm"},
        )

    async def do_replace():
        return await client.post(
            path + "/replacement",
            json={
                "expected_version": order["version"],
                "reason": "Replace in race",
                "order": {
                    "product_name": "Replacement Race Product",
                    "total_minor": 1400000,
                    "required_advance_minor": 200000,
                    "payment_account_id": order["payment_account_id"],
                },
            },
            headers={"Idempotency-Key": "race-replace"},
        )

    await connection.execute("BEGIN")
    await connection.execute("SELECT id FROM shops WHERE id = $1 FOR UPDATE", order["shop_id"])
    tasks = [asyncio.create_task(do_confirm()), asyncio.create_task(do_replace())]
    try:
        await wait_for_order_waiters(connection, 2)
    finally:
        await connection.execute("COMMIT")
        responses = await asyncio.gather(*tasks)

    # Exactly one serialized outcome succeeds (200/201), the other encounters 409
    statuses = sorted(r.status_code for r in responses)
    assert statuses in ([200, 409], [201, 409]), [r.text for r in responses]
