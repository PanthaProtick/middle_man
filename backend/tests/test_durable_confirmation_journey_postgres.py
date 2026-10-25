import datetime

import pytest

from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store
from app.services.transaction_store import reset_transaction_memory_store


@pytest.mark.asyncio
async def test_postgres_synthetic_seller_to_buyer_confirmation_journey(postgres_buyer):
    """
    AC03, AC06, AC08, AC12-AC18, AC21, AC37, AC39, AC49:
    Complete synthetic seller-to-buyer confirmation journey on real PostgreSQL.
    Walks from order creation through SMS import, buyer submission with representation
    variations, durable reconciliation, matching seller/buyer COD, same-key replays,
    and restart persistence.
    """
    client, connection, _, _ = postgres_buyer

    # 1. Setup shop, account, and order
    shop_res = await client.post(
        "/api/seller/shop",
        json={"display_name": "Silk Heritage BD"},
        headers={"Idempotency-Key": "journey-shop"},
    )
    assert shop_res.status_code in (200, 201)

    acc_res = await client.post(
        "/api/seller/payment-accounts",
        json={
            "provider": "bkash",
            "receiving_number": "01712349999",
            "label": "Primary Merchant bKash",
        },
        headers={"Idempotency-Key": "journey-acc"},
    )
    acc_id = acc_res.json()["id"]

    order_res = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Jamdani Saree",
            "total_minor": 600000,           # 6,000 BDT
            "required_advance_minor": 100000, # 1,000 BDT advance, 5,000 BDT expected COD
            "payment_account_id": acc_id,
        },
        headers={"Idempotency-Key": "journey-order"},
    )
    assert order_res.status_code == 201
    order = order_res.json()
    order_id = order["id"]
    portal_token = order["portal_token"]
    expected_cod = 500000
    advance = 100000

    # 2. Deactivate payment account after order creation (AC06)
    patch_res = await client.patch(
        f"/api/seller/payment-accounts/{acc_id}",
        json={"expected_version": 1, "label": "Deactivated bKash", "is_active": False},
    )
    assert patch_res.status_code == 200

    # Inactive account cannot be selected for a new order (AC06)
    bad_order_res = await client.post(
        "/api/seller/orders",
        json={
            "product_name": "Rejected Order Item",
            "total_minor": 100000,
            "required_advance_minor": 10000,
            "payment_account_id": acc_id,
        },
        headers={"Idempotency-Key": "journey-order-rejected"},
    )
    assert bad_order_res.status_code in (404, 422)

    # 3. Buyer opens link and verifies public projection (existing payment destination stays fixed)
    public_res = await client.get(f"/api/public/orders/{portal_token}")
    assert public_res.status_code == 200
    pub_initial = public_res.json()
    assert pub_initial["product_name"] == "Jamdani Saree"
    assert pub_initial["account_label"] == "Primary Merchant bKash"
    assert pub_initial["account_receiving_number"] == "01712349999"
    assert pub_initial["total_minor"] == 600000
    assert pub_initial["required_advance_minor"] == 100000
    assert pub_initial["expected_cod_minor"] == 500000
    assert pub_initial["actual_cod_minor"] is None
    assert pub_initial["lifecycle"] == "awaiting_buyer"
    assert "owner_id" not in pub_initial

    # 4. Seller receives SMS batch with valid item and unsupported item
    created_at = datetime.datetime.fromisoformat(order["created_at"])
    rec_time = created_at + datetime.timedelta(milliseconds=10)
    sms_valid = f"bKash: You have received Tk 1000.00 from 01899112233. TrxID SYNTH-JOURNEY-01 at {rec_time.isoformat()}"
    sms_unsupported = "Some arbitrary marketing or unrecognized SMS"

    sms_res = await client.post(
        "/api/seller/transactions/sms-import",
        json={"payment_account_id": acc_id, "messages": [sms_valid, sms_unsupported]},
        headers={"Idempotency-Key": "journey-sms-batch"},
    )
    assert sms_res.status_code == 200
    sms_items = sms_res.json()["items"]
    assert len(sms_items) == 2
    assert sms_items[0]["state"] == "imported"
    assert sms_items[1]["state"] == "unsupported"

    # 4. Buyer submits payment claim with representation variation (+880 country code format)
    sub_res = await client.post(
        f"/api/public/orders/{portal_token}/submission",
        json={
            "buyer_name": "Nusrat Jahan",
            "contact_number": "01755667788",
            "address": {"raw_text": "House 12, Road 4, Dhanmondi, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "SYNTH-JOURNEY-01",
                "sender_number": "+880 1899-112233",
                "amount_minor": advance,
            },
        },
        headers={"Idempotency-Key": "journey-sub-key"},
    )
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["lifecycle"] == "confirmed"
    assert sub_data["actual_cod_minor"] == expected_cod
    assert sub_data["submission_acknowledgement"] is not None

    # 5. Verify PostgreSQL durable records
    assert await connection.fetchval("SELECT lifecycle FROM orders WHERE id=$1", order_id) == "confirmed"
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order_id) == 1
    alloc_row = await connection.fetchrow("SELECT * FROM allocations WHERE order_id=$1", order_id)
    assert alloc_row["accepted_amount_minor"] == advance
    assert alloc_row["basis"] == "automatic"
    assert alloc_row["actor"] == "system"
    assert await connection.fetchval(
        "SELECT count(*) FROM used_payment_markers WHERE shop_id=(SELECT shop_id FROM orders WHERE id=$1)",
        order_id,
    ) == 1

    # 6. Verify Seller Order View
    seller_order = (await client.get(f"/api/seller/orders/{order_id}")).json()
    assert seller_order["lifecycle"] == "confirmed"
    assert seller_order["actual_cod_minor"] == expected_cod
    assert seller_order["allocation_basis"] == "automatic"

    # 7. Verify Buyer Public View
    buyer_order = (await client.get(f"/api/public/orders/{portal_token}")).json()
    assert buyer_order["lifecycle"] == "confirmed"
    assert buyer_order["actual_cod_minor"] == expected_cod
    assert buyer_order["total_minor"] - buyer_order["actual_cod_minor"] == advance
    assert buyer_order["actual_cod_minor"] == seller_order["actual_cod_minor"]

    # 8. Same-key retries preserve outcome without duplication
    buyer_retry = await client.post(
        f"/api/public/orders/{portal_token}/submission",
        json={
            "buyer_name": "Nusrat Jahan",
            "contact_number": "01755667788",
            "address": {"raw_text": "House 12, Road 4, Dhanmondi, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "SYNTH-JOURNEY-01",
                "sender_number": "+880 1899-112233",
                "amount_minor": advance,
            },
        },
        headers={"Idempotency-Key": "journey-sub-key"},
    )
    assert buyer_retry.status_code == 200
    assert buyer_retry.json() == sub_data
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id=$1", order_id) == 1

    # 9. Restart durability: reset in-memory stores and retrieve from DB
    reset_memory_store()
    reset_order_memory_store()
    reset_transaction_memory_store()

    seller_restarted = (await client.get(f"/api/seller/orders/{order_id}")).json()
    assert seller_restarted["lifecycle"] == "confirmed"
    assert seller_restarted["actual_cod_minor"] == expected_cod

    buyer_restarted = (await client.get(f"/api/public/orders/{portal_token}")).json()
    assert buyer_restarted["lifecycle"] == "confirmed"
    assert buyer_restarted["actual_cod_minor"] == expected_cod
