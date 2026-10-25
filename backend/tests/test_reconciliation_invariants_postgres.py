import datetime

import pytest


@pytest.mark.asyncio
async def test_postgres_bangla_digits_sender_matching(postgres_buyer):
    """
    AC08: Bangla digits and canonical sender representations (+880 vs local)
    reconcile and confirm on real PostgreSQL.
    """
    client, connection, _, order = postgres_buyer
    account_id = order["payment_account_id"]
    trx_id = "TRX-BANGLA-MATCH-01"
    advance = order["required_advance_minor"]
    expected_cod = order["total_minor"] - advance

    created_at = datetime.datetime.fromisoformat(order["created_at"])
    rec_time = created_at + datetime.timedelta(milliseconds=10)

    # 1. Seller records receipt with canonical standard ASCII number
    await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": account_id,
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": advance,
            "sender_number": "01822222222",
            "occurred_at": rec_time.isoformat(),
        },
        headers={"Idempotency-Key": "tx-bangla"},
    )

    # 2. Buyer submits claim using formatted number with Bangla digits
    # "০১৮২২২২২২২২" canonicalizes to "01822222222"
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "Bangla Buyer",
            "contact_number": "০১৭১১১১১১১১",
            "address": {"raw_text": "মিরপুর, ঢাকা"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": trx_id,
                "sender_number": "০১৮২২২২২২২২",
                "amount_minor": advance,
            },
        },
        headers={"Idempotency-Key": "sub-bangla"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["lifecycle"] == "confirmed"
    assert sub_res.json()["actual_cod_minor"] == expected_cod

    # Verify DB state
    assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order["id"]) == "confirmed"
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order["id"]) == 1
    # Raw reviewed values remain traceable (AC08)
    raw_sender = await connection.fetchval("SELECT payment_sender_raw FROM buyer_revisions WHERE order_id=$1", order["id"])
    assert raw_sender == "০১৮২২২২২২২২"


@pytest.mark.asyncio
async def test_postgres_contradictory_receipt_after_confirmation_preserves_order(postgres_buyer):
    """
    AC18, AC21: Contradictory observation arriving after confirmation preserves
    the existing confirmed order and records the conflict.
    """
    client, connection, _, order = postgres_buyer
    account_id = order["payment_account_id"]
    trx_id = "TRX-AC21-CONTRADICTION"
    advance = order["required_advance_minor"]
    expected_cod = order["total_minor"] - advance

    created_at = datetime.datetime.fromisoformat(order["created_at"])
    rec_time = created_at + datetime.timedelta(milliseconds=10)

    # 1. Reconcile and confirm order
    await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": account_id,
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": advance,
            "sender_number": "01822222222",
            "occurred_at": rec_time.isoformat(),
        },
        headers={"Idempotency-Key": "tx-ac21-1"},
    )
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "AC21 Buyer",
            "contact_number": "01711111111",
            "address": {"raw_text": "Banani, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": trx_id,
                "sender_number": "01822222222",
                "amount_minor": advance,
            },
        },
        headers={"Idempotency-Key": "sub-ac21-1"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["lifecycle"] == "confirmed"

    # 2. Contradictory observation arrives for the same trx_id with a different amount
    conflict_res = await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": account_id,
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": advance + 50000,
            "sender_number": "01822222222",
            "occurred_at": rec_time.isoformat(),
        },
        headers={"Idempotency-Key": "tx-ac21-conflict"},
    )
    assert conflict_res.status_code == 200
    conflict_data = conflict_res.json()
    assert conflict_data["has_conflict"] is True

    # 3. Order remains confirmed with its original allocation intact
    order_after = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert order_after["lifecycle"] == "confirmed"
    assert order_after["actual_cod_minor"] == expected_cod
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order["id"]) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("scenario", ["before_creation", "after_submission"])
async def test_postgres_ac15_payment_time_bounds_require_manual_review(postgres_buyer, scenario: str):
    """
    AC15: Payment occurred before order creation or after active claim submission
    does not auto-confirm; it requires manual review with typed TIME_UNCLEAR reason.
    """
    client, connection, _, order = postgres_buyer
    account_id = order["payment_account_id"]
    advance = order["required_advance_minor"]
    trx_id = f"TRX-AC15-{scenario.upper()}"
    created_at = datetime.datetime.fromisoformat(order["created_at"])

    # First buyer submits claim at submission_time
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "Time Test Buyer",
            "contact_number": "01711111111",
            "address": {"raw_text": "Time Bounds Lane, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": trx_id,
                "sender_number": "01822222222",
                "amount_minor": advance,
            },
        },
        headers={"Idempotency-Key": f"sub-{trx_id}"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["lifecycle"] == "pending"

    # Submission time from DB
    claim_time = await connection.fetchval(
        "SELECT created_at FROM buyer_revisions WHERE order_id=$1", order["id"]
    )

    if scenario == "before_creation":
        # Payment occurred 10 minutes BEFORE order was created
        bad_time = created_at - datetime.timedelta(minutes=10)
    else:
        # Payment occurred 10 minutes AFTER claim was submitted
        bad_time = claim_time + datetime.timedelta(minutes=10)

    tx_res = await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": account_id,
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": advance,
            "sender_number": "01822222222",
            "occurred_at": bad_time.isoformat(),
        },
        headers={"Idempotency-Key": f"tx-{trx_id}"},
    )
    assert tx_res.status_code in (200, 201)

    # Order must remain pending, no allocation created, review reasons contains TIME_UNCLEAR
    assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order["id"]) == "pending"
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order["id"]) == 0
    reasons = [
        r["reason"]
        for r in await connection.fetch(
            "SELECT reason FROM order_review_reasons WHERE order_id=$1", order["id"]
        )
    ]
    assert "TIME_UNCLEAR" in reasons

