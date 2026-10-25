import datetime

import pytest

from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store
from app.services.transaction_store import reset_transaction_memory_store


@pytest.mark.asyncio
@pytest.mark.parametrize("receipt_first", [True, False])
async def test_postgres_manual_receipt_both_arrival_orders(postgres_buyer, receipt_first: bool):
    """
    AC12, AC16: Both manual receipt / buyer claim arrival orders produce the same
    qualifying durable confirmation on real PostgreSQL with correct actual COD.
    """
    client, connection, _, order = postgres_buyer
    account_id = order["payment_account_id"]
    trx_id = f"TRX-ARRIVE-{'REC' if receipt_first else 'CLM'}"
    advance = order["required_advance_minor"]
    expected_cod = order["total_minor"] - advance

    # Ensure occurred_at satisfies AC15: order_created_at <= occurred_at <= claim_time
    created_at = datetime.datetime.fromisoformat(order["created_at"])
    rec_time = created_at + datetime.timedelta(milliseconds=10)

    tx_payload = {
        "payment_account_id": account_id,
        "provider": "bkash",
        "trx_id": trx_id,
        "amount_minor": advance,
        "sender_number": "01822222222",
        "occurred_at": rec_time.isoformat(),
    }
    buyer_payload = {
        "buyer_name": "Synthetic Buyer",
        "contact_number": "01711111111",
        "address": {"raw_text": "Durable Road, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": trx_id,
            "sender_number": "01822222222",
            "amount_minor": advance,
        },
    }

    async def record_receipt():
        res = await client.post("/api/seller/transactions", json=tx_payload, headers={"Idempotency-Key": f"tx-{trx_id}"})
        assert res.status_code in (200, 201)
        return res.json()

    async def submit_claim():
        res = await client.post(
            f"/api/public/orders/{order['portal_token']}/submission",
            json=buyer_payload,
            headers={"Idempotency-Key": f"sub-{trx_id}"},
        )
        assert res.status_code == 200
        return res.json()

    if receipt_first:
        await record_receipt()
        claim_res = await submit_claim()
        assert claim_res["lifecycle"] == "confirmed"
        assert claim_res["actual_cod_minor"] == expected_cod
    else:
        claim_res = await submit_claim()
        assert claim_res["lifecycle"] == "pending"
        assert claim_res["actual_cod_minor"] is None
        await record_receipt()

    # In both arrival orders, final DB state is confirmed with exactly one allocation and marker
    assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order["id"]) == "confirmed"
    assert await connection.fetchval("SELECT accepted_amount_minor FROM allocations WHERE order_id=$1", order["id"]) == advance
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order["id"]) == 1
    assert await connection.fetchval(
        "SELECT count(*) FROM used_payment_markers WHERE shop_id=(SELECT shop_id FROM orders WHERE id=$1)",
        order["id"],
    ) == 1

    # Verify seller view
    seller_view = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert seller_view["lifecycle"] == "confirmed"
    assert seller_view["actual_cod_minor"] == expected_cod
    assert seller_view["allocation_basis"] == "automatic"

    # Verify buyer public view
    buyer_view = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert buyer_view["lifecycle"] == "confirmed"
    assert buyer_view["actual_cod_minor"] == expected_cod
    assert buyer_view["total_minor"] - buyer_view["actual_cod_minor"] == advance


@pytest.mark.asyncio
async def test_postgres_restart_and_same_key_retry_preserves_confirmed_state(postgres_buyer):
    """
    AC37, AC39: Same-key retries and process restart preserve fixed terms,
    exactly one allocation, accepted amount, and consistent seller/buyer COD.
    """
    client, connection, _, order = postgres_buyer
    account_id = order["payment_account_id"]
    trx_id = "TRX-RESTART-RETRY-01"
    advance = order["required_advance_minor"]
    expected_cod = order["total_minor"] - advance

    created_at = datetime.datetime.fromisoformat(order["created_at"])
    rec_time = created_at + datetime.timedelta(milliseconds=10)

    # 1. Confirm order via manual receipt + buyer submission
    tx_res = await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": account_id,
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": advance,
            "sender_number": "01822222222",
            "occurred_at": rec_time.isoformat(),
        },
        headers={"Idempotency-Key": "tx-restart-key"},
    )
    assert tx_res.status_code in (200, 201)

    sub_payload = {
        "buyer_name": "Retry Buyer",
        "contact_number": "01711111111",
        "address": {"raw_text": "Restart Alley, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": trx_id,
            "sender_number": "01822222222",
            "amount_minor": advance,
        },
    }
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=sub_payload,
        headers={"Idempotency-Key": "sub-restart-key"},
    )
    assert sub_res.status_code == 200
    original_sub_json = sub_res.json()
    assert original_sub_json["lifecycle"] == "confirmed"

    # 2. Same-key retry of buyer submission returns identical response and does not duplicate allocation
    retry_sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=sub_payload,
        headers={"Idempotency-Key": "sub-restart-key"},
    )
    assert retry_sub_res.status_code == 200
    assert retry_sub_res.json() == original_sub_json
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order["id"]) == 1

    # 3. Same-key retry of seller transaction returns identical response without duplicating transaction
    retry_tx_res = await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": account_id,
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": advance,
            "sender_number": "01822222222",
            "occurred_at": rec_time.isoformat(),
        },
        headers={"Idempotency-Key": "tx-restart-key"},
    )
    assert retry_tx_res.status_code in (200, 201)
    assert await connection.fetchval("SELECT count(*) FROM received_transactions WHERE trx_id=$1", trx_id) == 1

    # 4. Simulate process restart by resetting in-memory stores
    reset_memory_store()
    reset_order_memory_store()
    reset_transaction_memory_store()

    # 5. Verify seller and buyer views retrieve the same confirmed state after restart
    seller_after = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert seller_after["lifecycle"] == "confirmed"
    assert seller_after["actual_cod_minor"] == expected_cod
    assert seller_after["allocation_basis"] == "automatic"

    buyer_after = (await client.get(f"/api/public/orders/{order['portal_token']}")).json()
    assert buyer_after["lifecycle"] == "confirmed"
    assert buyer_after["actual_cod_minor"] == expected_cod
    assert buyer_after["total_minor"] - buyer_after["actual_cod_minor"] == advance

