"""Real PostgreSQL invariants for conflict resolution, exception handling, and cancellation."""
import datetime
import json

import pytest


@pytest.mark.asyncio
async def test_postgres_confirmed_cancellation_preserves_allocation_and_markers(postgres_buyer):
    """AC34: Explicit cancellation before/after payment acceptance stops matching,

    retains reason/history, and never frees used payment or marker.
    """
    client, connection, _, order = postgres_buyer
    acc_id = order["payment_account_id"]
    shop_id = order["shop_id"]

    # Cancellation before payment acceptance (AC34): stops matching
    pre_cancel = await client.post(
        f"/api/seller/orders/{order['id']}/decisions",
        json={"action": "cancel", "expected_version": order["version"], "reason": "Pre-payment cancel"},
        headers={"Idempotency-Key": "pre-cancel-key"},
    )
    assert pre_cancel.status_code == 200 and pre_cancel.json()["lifecycle"] == "cancelled"
    sub_blocked = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={"buyer_name": "Late", "contact_number": "01711119991", "address": {"raw_text": "Dhaka"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-PRE-CANCEL", "sender_number": "01811119991", "amount_minor": 200000}},
        headers={"Idempotency-Key": "blocked-sub"},
    )
    assert sub_blocked.status_code == 409

    # Cancellation after payment acceptance (AC34): preserves allocation and markers
    ord_data = (await client.post(
        "/api/seller/orders",
        json={"product_name": "Premium Leather Bag", "total_minor": 1500000, "required_advance_minor": 300000, "payment_account_id": acc_id},
        headers={"Idempotency-Key": "order-cancel-test-1"},
    )).json()
    ord_id = ord_data["id"]

    created_at = datetime.datetime.fromisoformat(ord_data["created_at"])
    rec_time = created_at + datetime.timedelta(milliseconds=10)
    tx_data = (await client.post(
        "/api/seller/transactions",
        json={"payment_account_id": acc_id, "provider": "bkash", "trx_id": "TRX-CANCEL-PRESERVE-1",
              "amount_minor": 300000, "sender_number": "01811119991", "occurred_at": rec_time.isoformat()},
        headers={"Idempotency-Key": "tx-cancel-test-1"},
    )).json()

    await client.post(
        f"/api/public/orders/{ord_data['portal_token']}/submission",
        json={"buyer_name": "Cancel Test Buyer", "contact_number": "01711119991", "address": {"raw_text": "Dhaka"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-CANCEL-PRESERVE-1", "sender_number": "01811119991", "amount_minor": 300000}},
        headers={"Idempotency-Key": "claim-cancel-test-1"},
    )

    confirmed_order = (await client.get(f"/api/seller/orders/{ord_id}")).json()
    assert confirmed_order["lifecycle"] == "confirmed" and confirmed_order["actual_cod_minor"] == 1200000

    # Explicit cancellation of confirmed order
    cancel_res = await client.post(
        f"/api/seller/orders/{ord_id}/decisions",
        json={"action": "cancel", "expected_version": confirmed_order["version"], "reason": "Buyer requested cancellation post-confirmation"},
        headers={"Idempotency-Key": "cancel-confirmed-ac34"},
    )
    assert cancel_res.status_code == 200 and cancel_res.json()["lifecycle"] == "cancelled"

    # In PostgreSQL: allocations and used_payment_markers are NOT freed
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id = $1", ord_id) == 1
    assert await connection.fetchval("SELECT accepted_amount_minor FROM allocations WHERE order_id = $1", ord_id) == 300000
    assert await connection.fetchval("SELECT count(*) FROM used_payment_markers WHERE shop_id = $1", shop_id) >= 1

    audit_row = await connection.fetchrow(
        "SELECT action, details FROM audit_events WHERE aggregate_id = $1 AND action = 'order_cancelled'", ord_id
    )
    assert audit_row and json.loads(audit_row["details"])["reason"] == "Buyer requested cancellation post-confirmation"

    # Attempting to reuse the same transaction for a new order fails (remains used)
    ord2_data = (await client.post(
        "/api/seller/orders",
        json={"product_name": "Second Order", "total_minor": 1000000, "required_advance_minor": 300000, "payment_account_id": acc_id},
        headers={"Idempotency-Key": "order2-cancel-test"},
    )).json()
    await client.post(
        f"/api/public/orders/{ord2_data['portal_token']}/submission",
        json={"buyer_name": "Rival", "contact_number": "01722229992", "address": {"raw_text": "Ctg"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-CANCEL-PRESERVE-1", "sender_number": "01811119991", "amount_minor": 300000}},
        headers={"Idempotency-Key": "claim2-cancel-test"},
    )
    preview = await client.get(f"/api/seller/orders/{ord2_data['id']}/payment-preview", params={"transaction_id": tx_data["id"]})
    assert preview.status_code == 200 and "PAYMENT_USED" in preview.json()["blockers"]


@pytest.mark.asyncio
async def test_postgres_pending_rejection_and_terminal_projection(postgres_buyer):
    """AC35: Explicit seller rejection sets terminal state and blocks resubmission loop."""
    client, connection, _, order = postgres_buyer
    acc_id = order["payment_account_id"]

    ord_data = (await client.post(
        "/api/seller/orders",
        json={"product_name": "Silk Scarf", "total_minor": 800000, "required_advance_minor": 200000, "payment_account_id": acc_id},
        headers={"Idempotency-Key": "order-reject-test-1"},
    )).json()
    ord_id = ord_data["id"]
    token = ord_data["portal_token"]

    await client.post(
        f"/api/public/orders/{token}/submission",
        json={"buyer_name": "Reject Target Buyer", "contact_number": "01733339993", "address": {"raw_text": "Sylhet City"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-SUSPICIOUS-CLAIM", "sender_number": "01833339993", "amount_minor": 200000}},
        headers={"Idempotency-Key": "claim-reject-test-1"},
    )

    # Explicit seller rejection
    reject_res = await client.post(
        f"/api/seller/orders/{ord_id}/decisions",
        json={"action": "reject", "expected_version": 2, "reason": "Payment claim details suspect and unverifiable"},
        headers={"Idempotency-Key": "reject-decision-ac35"},
    )
    assert reject_res.status_code == 200 and reject_res.json()["lifecycle"] == "rejected"

    # PostgreSQL direct checks
    db_row = await connection.fetchrow("SELECT lifecycle, version, completed_at FROM orders WHERE id = $1", ord_id)
    assert db_row["lifecycle"] == "rejected" and db_row["version"] == 3 and db_row["completed_at"] is not None

    # Public projection terminal and resubmission blocked
    pub = (await client.get(f"/api/public/orders/{token}")).json()
    assert pub["lifecycle"] == "rejected"

    retry_sub = await client.post(
        f"/api/public/orders/{token}/submission",
        json={"buyer_name": "Retry Buyer", "contact_number": "01733339993", "address": {"raw_text": "Sylhet City"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-SUSPICIOUS-CLAIM-2", "sender_number": "01833339993", "amount_minor": 200000}},
        headers={"Idempotency-Key": "claim-retry-blocked"},
    )
    assert retry_sub.status_code == 409 and retry_sub.json()["error"]["code"] == "ORDER_ALREADY_SUBMITTED"


@pytest.mark.asyncio
async def test_postgres_over_total_and_confirmed_terms_invariants(postgres_buyer):
    """AC24, AC26, AC30, AC38: Over-total rejection, negative manual decision paths, and idempotency."""
    client, connection, _, order = postgres_buyer
    acc_id = order["payment_account_id"]

    # 1. Over-total payment stays unresolved (AC26)
    ord_res = (await client.post(
        "/api/seller/orders",
        json={"product_name": "Small Item", "total_minor": 400000, "required_advance_minor": 100000, "payment_account_id": acc_id},
        headers={"Idempotency-Key": "order-overtotal-1"},
    )).json()
    ord_id = ord_res["id"]
    await client.post(
        f"/api/public/orders/{ord_res['portal_token']}/submission",
        json={"buyer_name": "Over Buyer", "contact_number": "01744449994", "address": {"raw_text": "Dhaka"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-EXCESSIVE-PAYMENT", "sender_number": "01844449994", "amount_minor": 500000}},
        headers={"Idempotency-Key": "claim-overtotal-1"},
    )
    tx_res = (await client.post(
        "/api/seller/transactions",
        json={"payment_account_id": acc_id, "provider": "bkash", "trx_id": "TRX-EXCESSIVE-PAYMENT", "amount_minor": 500000, "sender_number": "01844449994"},
        headers={"Idempotency-Key": "tx-overtotal-1"},
    )).json()
    preview = (await client.get(f"/api/seller/orders/{ord_id}/payment-preview", params={"transaction_id": tx_res["id"]})).json()
    assert "PAYMENT_EXCEEDS_TOTAL" in preview["blockers"] and preview["actual_cod_minor"] is None

    # Over-total full acceptance is rejected (AC26)
    dec_over = await client.post(
        f"/api/seller/orders/{ord_id}/decisions",
        json={"action": "confirm", "expected_version": 2, "expected_transaction_version": 1,
              "transaction_id": tx_res["id"], "accepted_amount_minor": 500000, "reason": "Attempt excessive acceptance"},
        headers={"Idempotency-Key": "dec-over-fail"},
    )
    assert dec_over.status_code == 409 and dec_over.json()["error"]["code"] == "PAYMENT_EXCEEDS_TOTAL"

    # Attempted smaller allocation of over-total payment is also rejected (AC26)
    dec_split = await client.post(
        f"/api/seller/orders/{ord_id}/decisions",
        json={"action": "confirm", "expected_version": 2, "expected_transaction_version": 1,
              "transaction_id": tx_res["id"], "accepted_amount_minor": 100000, "reason": "Attempt split allocation"},
        headers={"Idempotency-Key": "dec-split-fail"},
    )
    assert dec_split.status_code in (409, 422)
    assert dec_split.json()["error"]["code"] in ("PAYMENT_EXCEEDS_TOTAL", "ACTUAL_AMOUNT_REQUIRED")

    # Negative manual confirmation paths (AC24)
    # Missing transaction ID
    bad_tx = await client.post(
        f"/api/seller/orders/{ord_id}/decisions",
        json={"action": "confirm", "expected_version": 2, "accepted_amount_minor": 100000, "reason": "No tx"},
        headers={"Idempotency-Key": "bad-tx"},
    )
    assert bad_tx.status_code == 422
    # Blank reason
    blank_reason = await client.post(
        f"/api/seller/orders/{ord_id}/decisions",
        json={"action": "confirm", "expected_version": 2, "expected_transaction_version": 1,
              "transaction_id": tx_res["id"], "accepted_amount_minor": 500000, "reason": "   "},
        headers={"Idempotency-Key": "blank-reason"},
    )
    assert blank_reason.status_code == 422
    # Nonexistent/cross-shop order
    foreign = await client.post(
        "/api/seller/orders/nonexistent-order-id/decisions",
        json={"action": "confirm", "expected_version": 1, "expected_transaction_version": 1,
              "transaction_id": tx_res["id"], "accepted_amount_minor": 100000, "reason": "Foreign"},
        headers={"Idempotency-Key": "foreign-ord"},
    )
    assert foreign.status_code == 404

    # 2. Cancel order and verify idempotency replay and conflict (AC38)
    cancel_payload = {"action": "cancel", "expected_version": 2, "reason": "Order cancelled due to excess"}
    cancel_ok = await client.post(
        f"/api/seller/orders/{ord_id}/decisions", json=cancel_payload, headers={"Idempotency-Key": "dec-cancel-key"}
    )
    assert cancel_ok.status_code == 200 and cancel_ok.json()["lifecycle"] == "cancelled"

    cancel_replay = await client.post(
        f"/api/seller/orders/{ord_id}/decisions", json=cancel_payload, headers={"Idempotency-Key": "dec-cancel-key"}
    )
    assert cancel_replay.status_code == 200 and cancel_replay.json() == cancel_ok.json()

    diff_payload = {"action": "cancel", "expected_version": 2, "reason": "Different reason string"}
    conflict_res = await client.post(
        f"/api/seller/orders/{ord_id}/decisions", json=diff_payload, headers={"Idempotency-Key": "dec-cancel-key"}
    )
    assert conflict_res.status_code == 409 and conflict_res.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
