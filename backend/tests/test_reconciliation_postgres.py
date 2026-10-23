import datetime
import uuid

import pytest


@pytest.mark.asyncio
async def test_postgres_allocation_unique_constraints(postgres_buyer):
    """
    AC14 & Relational Invariants 3 & 4:
    PostgreSQL enforces at most one allocation per receipt and per order.
    """
    client, connection, sessions, order = postgres_buyer

    # Get shop_id and payment_account_id
    shop_id = await connection.fetchval("SELECT shop_id FROM orders WHERE id=$1", order["id"])
    account_id = await connection.fetchval("SELECT payment_account_id FROM orders WHERE id=$1", order["id"])

    # Create two transactions
    tx1_id = str(uuid.uuid4())
    tx2_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc)

    for tx_id, trx_code in [(tx1_id, "TRX-SQL-1"), (tx2_id, "TRX-SQL-2")]:
        await connection.execute("""
            INSERT INTO received_transactions (
                id, shop_id, payment_account_id, provider, trx_id, amount_minor,
                sender_number_raw, sender_number_canonical, occurred_at, reconciliation_state,
                has_conflict, version, created_at, updated_at
            ) VALUES ($1, $2, $3, 'bkash', $4, 200000, '01822222222', '01822222222', $5, 'unmatched', false, 1, $5, $5)
        """, tx_id, shop_id, account_id, trx_code, now)

    # 1. Insert first allocation for order and tx1
    alloc1_id = str(uuid.uuid4())
    await connection.execute("""
        INSERT INTO allocations (id, shop_id, order_id, transaction_id, accepted_amount_minor, basis, actor, created_at)
        VALUES ($1, $2, $3, $4, 200000, 'automatic', 'system', $5)
    """, alloc1_id, shop_id, order["id"], tx1_id, now)

    # 2. Attempt second allocation for the same order (with tx2) -> violates uq_allocations_order_id!
    alloc2_id = str(uuid.uuid4())
    with pytest.raises(Exception) as exc_order:
        await connection.execute("""
            INSERT INTO allocations (id, shop_id, order_id, transaction_id, accepted_amount_minor, basis, actor, created_at)
            VALUES ($1, $2, $3, $4, 200000, 'automatic', 'system', $5)
        """, alloc2_id, shop_id, order["id"], tx2_id, now)
    assert "uq_allocations_order_id" in str(exc_order.value)

    # Create a second order in the same shop
    order2_id = str(uuid.uuid4())
    await connection.execute("""
        INSERT INTO orders (
            id, shop_id, payment_account_id, token_lookup_digest, encrypted_portal_token,
            product_name, total_minor, required_advance_minor, account_provider,
            account_receiving_number, account_label, lifecycle, version, created_at,
            updated_at, expires_at
        ) VALUES (
            $1, $2, $3, 'digest2', 'token2', 'Product 2', 500000, 200000, 'bkash',
            '01711111111', 'Label', 'pending', 1, $4, $4, $4
        )
    """, order2_id, shop_id, account_id, now)

    # 3. Attempt second allocation for the SAME transaction tx1 (with order2) -> violates uq_allocations_transaction_id!
    alloc3_id = str(uuid.uuid4())
    with pytest.raises(Exception) as exc_tx:
        await connection.execute("""
            INSERT INTO allocations (id, shop_id, order_id, transaction_id, accepted_amount_minor, basis, actor, created_at)
            VALUES ($1, $2, $3, $4, 200000, 'automatic', 'system', $5)
        """, alloc3_id, shop_id, order2_id, tx1_id, now)
    assert "uq_allocations_transaction_id" in str(exc_tx.value)


@pytest.mark.asyncio
async def test_postgres_automatic_confirmation_e2e(postgres_buyer):
    """
    AC12, AC16: End-to-end receipt recording and buyer submission on real PostgreSQL.
    Reconciles, creates durable allocation, updates order to confirmed with actual COD.
    """
    client, connection, _, order = postgres_buyer

    # 1. Seller records matching receipt
    account_id = await connection.fetchval("SELECT payment_account_id FROM orders WHERE id=$1", order["id"])
    rec_time = datetime.datetime.now(datetime.timezone.utc)

    # Create receipt via seller API endpoint
    tx_payload = {
        "payment_account_id": account_id,
        "provider": "bkash",
        "trx_id": "PG-TRX-MATCH",
        "amount_minor": 200000, # matches advance
        "sender_number": "01822222222",
        "occurred_at": rec_time.isoformat(),
    }
    tx_res = await client.post("/api/seller/transactions", json=tx_payload, headers={"Authorization": "Bearer mock-seller-token"})
    assert tx_res.status_code in (200, 201)

    # 2. Buyer submits matching claim
    buyer_payload = {
        "buyer_name": "PG Buyer",
        "contact_number": "01711111111",
        "address": {"raw_text": "PG Address, Dhaka"},
        "payment_claim": {
            "provider": "bkash",
            "trx_id": "PG-TRX-MATCH",
            "sender_number": "01822222222",
            "amount_minor": 200000,
        },
    }
    sub_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json=buyer_payload,
        headers={"Idempotency-Key": "pg-sub-key-1"},
    )
    assert sub_res.status_code == 200
    pub_data = sub_res.json()
    assert pub_data["lifecycle"] == "confirmed"
    assert pub_data["actual_cod_minor"] == pub_data["total_minor"] - 200000

    # Verify PostgreSQL state
    assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order["id"]) == "confirmed"
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order["id"]) == 1
    assert await connection.fetchval("SELECT count(*) FROM used_payment_markers WHERE shop_id=(SELECT shop_id FROM orders WHERE id=$1)", order["id"]) == 1
    assert await connection.fetchval("SELECT count(*) FROM audit_events WHERE aggregate_id=$1", order["id"]) == 1
