import datetime

import pytest

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app


@pytest.mark.asyncio
async def test_postgres_unsupported_sms_stays_unresolved_zero_ai_and_manual_recovery(postgres_buyer):
    """
    AC49, AC13, AC14: Unsupported SMS stays visibly unresolved without any AI call.
    Seller can then manually record the transaction to confirm the pending claim.
    """
    client, connection, _, order = postgres_buyer
    advance = order["required_advance_minor"]
    expected_cod = order["total_minor"] - advance
    account_id = order["payment_account_id"]
    trx_id = "TRX-MANUAL-FALLBACK-01"

    # 1. Buyer submits claim first -> becomes pending
    buyer_res = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": "Fallback Buyer",
            "contact_number": "01711111111",
            "address": {"raw_text": "Gulshan, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": trx_id,
                "sender_number": "01822222222",
                "amount_minor": advance,
            },
        },
        headers={"Idempotency-Key": "sub-fallback-1"},
    )
    assert buyer_res.status_code == 200
    assert buyer_res.json()["lifecycle"] == "pending"

    # 2. Seller imports an unsupported SMS
    unsupported_text = "Standard Bank: Your acct 1234 credited with 2000 BDT. Ref unknown."
    import_res = await client.post(
        "/api/seller/transactions/sms-import",
        json={"payment_account_id": account_id, "messages": [unsupported_text]},
        headers={"Idempotency-Key": "sms-unsupported-key"},
    )
    assert import_res.status_code == 200
    items = import_res.json()["items"]
    assert len(items) == 1
    assert items[0]["state"] == "unsupported"
    assert items[0]["receipt_id"] is None

    # Order remains pending with zero allocations
    assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order["id"]) == "pending"
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order["id"]) == 0

    # 3. Seller falls back to manual entry with the verified details
    created_at = datetime.datetime.fromisoformat(order["created_at"])
    rec_time = created_at + datetime.timedelta(milliseconds=10)
    manual_res = await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": account_id,
            "provider": "bkash",
            "trx_id": trx_id,
            "amount_minor": advance,
            "sender_number": "01822222222",
            "occurred_at": rec_time.isoformat(),
        },
        headers={"Idempotency-Key": "tx-manual-fallback-key"},
    )
    assert manual_res.status_code in (200, 201)

    # 4. Order is now confirmed with exactly one allocation
    assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order["id"]) == "confirmed"
    assert await connection.fetchval("SELECT accepted_amount_minor FROM allocations WHERE order_id=$1", order["id"]) == advance
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order["id"]) == 1

    seller_view = (await client.get(f"/api/seller/orders/{order['id']}")).json()
    assert seller_view["lifecycle"] == "confirmed"
    assert seller_view["actual_cod_minor"] == expected_cod


@pytest.mark.asyncio
async def test_postgres_cross_shop_same_trx_id_isolation(postgres_buyer):
    """
    AC03: Same TrxID appears in independently supplied records in two shops.
    Checking remains separate; no global buyer-claim lock or collision.
    """
    client, connection, _, order1 = postgres_buyer
    shared_trx = "TRX-CROSS-SHOP-SHARED"
    advance = 200000

    # 1. Shop 1 records receipt and buyer submits claim -> Shop 1 order confirms
    created1 = datetime.datetime.fromisoformat(order1["created_at"])
    rec_time1 = created1 + datetime.timedelta(milliseconds=10)

    await client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": order1["payment_account_id"],
            "provider": "bkash",
            "trx_id": shared_trx,
            "amount_minor": advance,
            "sender_number": "01822222222",
            "occurred_at": rec_time1.isoformat(),
        },
        headers={"Idempotency-Key": "shop1-tx"},
    )
    res1 = await client.post(
        f"/api/public/orders/{order1['portal_token']}/submission",
        json={
            "buyer_name": "Buyer Shop 1",
            "contact_number": "01711111111",
            "address": {"raw_text": "Shop 1 Road"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": shared_trx,
                "sender_number": "01822222222",
                "amount_minor": advance,
            },
        },
        headers={"Idempotency-Key": "shop1-sub"},
    )
    assert res1.status_code == 200
    assert res1.json()["lifecycle"] == "confirmed"

    # 2. Switch identity to Shop 2
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="seller_shop_two")
    try:
        # Create Shop 2
        shop2_res = await client.post(
            "/api/seller/shop",
            json={"display_name": "Shop Two"},
            headers={"Idempotency-Key": "shop2-create"},
        )
        assert shop2_res.status_code in (200, 201)

        acc2_res = await client.post(
            "/api/seller/payment-accounts",
            json={
                "provider": "bkash",
                "receiving_number": "01799887766",
                "label": "Shop 2 bKash",
            },
            headers={"Idempotency-Key": "shop2-acc"},
        )
        acc2_id = acc2_res.json()["id"]

        order2_res = await client.post(
            "/api/seller/orders",
            json={
                "product_name": "Shop 2 Product",
                "total_minor": 800000,
                "required_advance_minor": advance,
                "payment_account_id": acc2_id,
            },
            headers={"Idempotency-Key": "shop2-order"},
        )
        order2 = order2_res.json()

        created2 = datetime.datetime.fromisoformat(order2["created_at"])
        rec_time2 = created2 + datetime.timedelta(milliseconds=10)

        # Shop 2 records receipt with SAME TrxID and buyer submits claim
        await client.post(
            "/api/seller/transactions",
            json={
                "payment_account_id": acc2_id,
                "provider": "bkash",
                "trx_id": shared_trx,
                "amount_minor": advance,
                "sender_number": "01833333333",
                "occurred_at": rec_time2.isoformat(),
            },
            headers={"Idempotency-Key": "shop2-tx"},
        )
        res2 = await client.post(
            f"/api/public/orders/{order2['portal_token']}/submission",
            json={
                "buyer_name": "Buyer Shop 2",
                "contact_number": "01722222222",
                "address": {"raw_text": "Shop 2 Road"},
                "payment_claim": {
                    "provider": "bkash",
                    "trx_id": shared_trx,
                    "sender_number": "01833333333",
                    "amount_minor": advance,
                },
            },
            headers={"Idempotency-Key": "shop2-sub"},
        )
        assert res2.status_code == 200
        assert res2.json()["lifecycle"] == "confirmed"

        # Both orders are confirmed in PostgreSQL without collision
        assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order1["id"]) == "confirmed"
        assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order2["id"]) == "confirmed"
        assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order1["id"]) == 1
        assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order2["id"]) == 1
    finally:
        app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="synthetic-postgres")
