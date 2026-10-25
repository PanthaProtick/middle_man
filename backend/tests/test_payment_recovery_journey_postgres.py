"""Complete synthetic conflict, exception, correction, and recovery journey on PostgreSQL."""
import datetime

import pytest

from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store
from app.services.transaction_store import reset_transaction_memory_store


@pytest.mark.asyncio
async def test_postgres_synthetic_conflict_and_recovery_journey(postgres_buyer):
    """AC19–AC21, AC24–AC30, AC34–AC35, AC38:

    Complete synthetic seller-to-buyer conflict and recovery journey on PostgreSQL.
    """
    client, connection, _, order = postgres_buyer
    acc_id = order["payment_account_id"]

    # -------------------------------------------------------------------------
    # Phase 1: Two orders compete for the same TrxID with conflicting observations (AC19, AC20)
    # -------------------------------------------------------------------------
    ord1 = (await client.post(
        "/api/seller/orders",
        json={"product_name": "Silk Jamdani", "total_minor": 1000000, "required_advance_minor": 200000, "payment_account_id": acc_id},
        headers={"Idempotency-Key": "rec-ord-1"},
    )).json()
    ord2 = (await client.post(
        "/api/seller/orders",
        json={"product_name": "Cotton Kurti", "total_minor": 1200000, "required_advance_minor": 200000, "payment_account_id": acc_id},
        headers={"Idempotency-Key": "rec-ord-2"},
    )).json()

    # Both buyers submit claims with identical TrxID
    await client.post(
        f"/api/public/orders/{ord1['portal_token']}/submission",
        json={"buyer_name": "Buyer One", "contact_number": "01711115551", "address": {"raw_text": "Dhaka"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-SHARED-CONFLICT", "sender_number": "01811115551", "amount_minor": 200000}},
        headers={"Idempotency-Key": "claim-ord-1"},
    )
    await client.post(
        f"/api/public/orders/{ord2['portal_token']}/submission",
        json={"buyer_name": "Buyer Two", "contact_number": "01711115552", "address": {"raw_text": "Chittagong"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-SHARED-CONFLICT", "sender_number": "01811115552", "amount_minor": 200000}},
        headers={"Idempotency-Key": "claim-ord-2"},
    )

    # First observation recorded by seller
    created_at = datetime.datetime.fromisoformat(ord1["created_at"])
    rec_time = created_at + datetime.timedelta(milliseconds=10)
    tx1 = (await client.post(
        "/api/seller/transactions",
        json={"payment_account_id": acc_id, "provider": "bkash", "trx_id": "TRX-SHARED-CONFLICT",
              "amount_minor": 200000, "sender_number": "01811115551", "occurred_at": rec_time.isoformat()},
        headers={"Idempotency-Key": "tx-obs-1"},
    )).json()

    # Second contradictory observation for the same TrxID arrives
    await client.post(
        "/api/seller/transactions",
        json={"payment_account_id": acc_id, "provider": "bkash", "trx_id": "TRX-SHARED-CONFLICT",
              "amount_minor": 190000, "sender_number": "01811115551", "occurred_at": rec_time.isoformat()},
        headers={"Idempotency-Key": "tx-obs-2"},
    )

    # Both orders remain pending; receipt shows conflict and competing claims
    comp_before = (await client.get(f"/api/seller/transactions/{tx1['id']}")).json()
    assert comp_before["receipt"]["has_conflict"] is True
    assert len(comp_before["claims"]) == 2
    assert (await client.get(f"/api/seller/orders/{ord1['id']}")).json()["lifecycle"] == "pending"
    assert (await client.get(f"/api/seller/orders/{ord2['id']}")).json()["lifecycle"] == "pending"
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 0

    # -------------------------------------------------------------------------
    # Phase 2: Seller resolves evidence in favor of Order 1 (AC19, AC20)
    # -------------------------------------------------------------------------
    obs_valid = next(o for o in comp_before["receipt"]["observations"] if o["amount_minor"] == 200000)
    resolve_res = await client.post(
        f"/api/seller/transactions/{tx1['id']}/resolve",
        json={
            "expected_version": comp_before["receipt"]["version"],
            "selected_observation_id": obs_valid["id"],
            "selected_order_id": ord1["id"],
            "reason": "Matched verified bank SMS receipt to Order 1",
        },
        headers={"Idempotency-Key": "resolve-tx1"},
    )
    assert resolve_res.status_code == 200, resolve_res.text

    # Order 1 confirms; Order 2 remains pending with held_by_resolution flag
    ord1_after = (await client.get(f"/api/seller/orders/{ord1['id']}")).json()
    assert ord1_after["lifecycle"] == "confirmed"
    assert ord1_after["actual_cod_minor"] == 800000  # 1000k - 200k

    comp_resolved = (await client.get(f"/api/seller/transactions/{tx1['id']}")).json()
    ord2_claim = next(c for c in comp_resolved["claims"] if c["order_id"] == ord2["id"])
    assert ord2_claim["held_by_resolution"] is True
    assert (await client.get(f"/api/seller/orders/{ord2['id']}")).json()["lifecycle"] == "pending"
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id = $1", ord1["id"]) == 1

    # -------------------------------------------------------------------------
    # Phase 3: Post-confirmation observation and late claim preserve confirmation (AC21)
    # -------------------------------------------------------------------------
    await client.post(
        "/api/seller/transactions",
        json={"payment_account_id": acc_id, "provider": "bkash", "trx_id": "TRX-SHARED-CONFLICT",
              "amount_minor": 205000, "sender_number": "01811115551", "occurred_at": rec_time.isoformat()},
        headers={"Idempotency-Key": "tx-obs-post-conf"},
    )
    # New claim for confirmed TrxID arrives after confirmation (AC21)
    ord_late = (await client.post(
        "/api/seller/orders",
        json={"product_name": "Late Order", "total_minor": 900000, "required_advance_minor": 200000, "payment_account_id": acc_id},
        headers={"Idempotency-Key": "rec-ord-late"},
    )).json()
    await client.post(
        f"/api/public/orders/{ord_late['portal_token']}/submission",
        json={"buyer_name": "Late Buyer", "contact_number": "01711115559", "address": {"raw_text": "Dhaka"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-SHARED-CONFLICT", "sender_number": "01811115551", "amount_minor": 200000}},
        headers={"Idempotency-Key": "claim-ord-late"},
    )
    # Order 1 stays confirmed, allocation intact, late order stays pending, receipt flags conflict as alert
    assert (await client.get(f"/api/seller/orders/{ord1['id']}")).json()["lifecycle"] == "confirmed"
    assert (await client.get(f"/api/seller/orders/{ord_late['id']}")).json()["lifecycle"] == "pending"
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id = $1", ord1["id"]) == 1
    comp_post = (await client.get(f"/api/seller/transactions/{tx1['id']}")).json()
    assert comp_post["receipt"]["has_conflict"] is True

    # -------------------------------------------------------------------------
    # Phase 4: Order 2 recovery via Seller Buyer Correction (AC27)
    # -------------------------------------------------------------------------
    ord2_cur = (await client.get(f"/api/seller/orders/{ord2['id']}")).json()
    correct_res = await client.patch(
        f"/api/seller/orders/{ord2['id']}/buyer-details",
        json={
            "expected_version": ord2_cur["version"],
            "reason": "Corrected TrxID from buyer payment slip",
            "payment_claim": {
                "provider": "bkash",
                "trx_id": "TRX-ORDER2-LEGIT",
                "sender_number": "01811115552",
                "amount_minor": 200000,
            },
        },
        headers={"Idempotency-Key": "correct-ord2-claim"},
    )
    assert correct_res.status_code == 200, correct_res.text
    assert correct_res.json()["buyer_revision"] == 2

    # Seller records matching transaction for Order 2's corrected TrxID
    tx2_res = await client.post(
        "/api/seller/transactions",
        json={"payment_account_id": acc_id, "provider": "bkash", "trx_id": "TRX-ORDER2-LEGIT",
              "amount_minor": 200000, "sender_number": "01811115552", "occurred_at": rec_time.isoformat()},
        headers={"Idempotency-Key": "tx-ord2-legit"},
    )
    assert tx2_res.status_code == 201

    # Order 2 reconciles automatically and confirms!
    ord2_after = (await client.get(f"/api/seller/orders/{ord2['id']}")).json()
    assert ord2_after["lifecycle"] == "confirmed"
    assert ord2_after["actual_cod_minor"] == 1000000  # 1200k - 200k
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 2

    # -------------------------------------------------------------------------
    # Phase 5: Confirmed delivery correction vs payment fields lock (AC29, AC30)
    # -------------------------------------------------------------------------
    # Updating delivery address on confirmed order succeeds (AC29)
    ord1_cur = (await client.get(f"/api/seller/orders/{ord1['id']}")).json()
    deliv_update = await client.patch(
        f"/api/seller/orders/{ord1['id']}/buyer-details",
        json={
            "expected_version": ord1_cur["version"],
            "reason": "Customer updated delivery apartment number",
            "address": {"raw_text": "Apartment 4B, House 12, Gulshan 1, Dhaka"},
        },
        headers={"Idempotency-Key": "update-deliv-ord1"},
    )
    assert deliv_update.status_code == 200
    assert deliv_update.json()["lifecycle"] == "confirmed"
    assert deliv_update.json()["actual_cod_minor"] == 800000  # Balance unchanged

    # Attempting to edit payment claim on confirmed order is rejected with 409 (AC30)
    ord1_latest = (await client.get(f"/api/seller/orders/{ord1['id']}")).json()
    pay_tamper = await client.patch(
        f"/api/seller/orders/{ord1['id']}/buyer-details",
        json={
            "expected_version": ord1_latest["version"],
            "reason": "Attempting payment claim modification",
            "payment_claim": {"provider": "bkash", "trx_id": "TRX-MODIFIED", "sender_number": "01811115551", "amount_minor": 200000},
        },
        headers={"Idempotency-Key": "tamper-pay-ord1"},
    )
    assert pay_tamper.status_code == 409
    assert pay_tamper.json()["error"]["code"] == "PAYMENT_FIELDS_LOCKED"

    # Anonymous / unauthenticated request to seller buyer-details rejected with 401 (AC28)
    from app.core.auth import get_seller_identity
    from app.main import app
    orig_auth = app.dependency_overrides.pop(get_seller_identity, None)
    try:
        anon_attempt = await client.patch(
            f"/api/seller/orders/{ord1['id']}/buyer-details",
            json={"expected_version": ord1_latest["version"], "reason": "No auth", "address": {"raw_text": "Tampered"}},
            headers={"Idempotency-Key": "no-auth-correct"},
        )
        assert anon_attempt.status_code == 401
    finally:
        if orig_auth:
            app.dependency_overrides[get_seller_identity] = orig_auth

    # -------------------------------------------------------------------------
    # Phase 6: Manual exception preview and confirmation (AC24, AC25, AC26)
    # -------------------------------------------------------------------------
    ord3 = (await client.post(
        "/api/seller/orders",
        json={"product_name": "Designer Panjabi", "total_minor": 800000, "required_advance_minor": 150000, "payment_account_id": acc_id},
        headers={"Idempotency-Key": "rec-ord-3"},
    )).json()

    # Buyer pays 200k (larger advance within total of 800k)
    await client.post(
        f"/api/public/orders/{ord3['portal_token']}/submission",
        json={"buyer_name": "Buyer Three", "contact_number": "01711115553", "address": {"raw_text": "Dhaka"},
              "payment_claim": {"provider": "bkash", "trx_id": "TRX-ORD3-LARGER", "sender_number": "01811115553", "amount_minor": 200000}},
        headers={"Idempotency-Key": "claim-ord-3"},
    )
    tx3 = (await client.post(
        "/api/seller/transactions",
        json={"payment_account_id": acc_id, "provider": "bkash", "trx_id": "TRX-ORD3-LARGER",
              "amount_minor": 200000, "sender_number": "01811115553", "occurred_at": rec_time.isoformat()},
        headers={"Idempotency-Key": "tx-ord-3"},
    )).json()

    preview3 = (await client.get(f"/api/seller/orders/{ord3['id']}/payment-preview", params={"transaction_id": tx3["id"]})).json()
    assert "AMOUNT_MISMATCH" in preview3["exceptions"]
    assert preview3["accepted_amount_minor"] == 200000
    assert preview3["actual_cod_minor"] == 600000  # 800k - 200k

    # Seller accepts exception (AC25)
    confirm3_res = await client.post(
        f"/api/seller/orders/{ord3['id']}/decisions",
        json={"action": "confirm", "expected_version": 2, "expected_transaction_version": 1,
              "transaction_id": tx3["id"], "accepted_amount_minor": 200000, "reason": "Accept larger advance"},
        headers={"Idempotency-Key": "confirm-ord-3"},
    )
    assert confirm3_res.status_code == 200
    ord3_confirmed = confirm3_res.json()
    assert ord3_confirmed["lifecycle"] == "confirmed"
    assert ord3_confirmed["actual_cod_minor"] == 600000

    # -------------------------------------------------------------------------
    # Phase 7: Order Cancellation and Rejection durability (AC34, AC35)
    # -------------------------------------------------------------------------
    # Cancel confirmed Order 3 -> allocation preserved (AC34)
    cancel3_res = await client.post(
        f"/api/seller/orders/{ord3['id']}/decisions",
        json={"action": "cancel", "expected_version": ord3_confirmed["version"], "reason": "Seller cancelled confirmed order"},
        headers={"Idempotency-Key": "cancel-ord-3"},
    )
    assert cancel3_res.status_code == 200
    assert cancel3_res.json()["lifecycle"] == "cancelled"
    assert await connection.fetchval("SELECT count(*) FROM allocations WHERE order_id = $1", ord3["id"]) == 1

    # Stale version rejection (AC38)
    stale_attempt = await client.post(
        f"/api/seller/orders/{ord3['id']}/decisions",
        json={"action": "cancel", "expected_version": 1, "reason": "Stale version attempt"},
        headers={"Idempotency-Key": "stale-key"},
    )
    assert stale_attempt.status_code == 409
    assert stale_attempt.json()["error"]["code"] == "STALE_VERSION"

    # -------------------------------------------------------------------------
    # Phase 8: Durability across memory reset (AC39)
    # -------------------------------------------------------------------------
    reset_order_memory_store()
    reset_transaction_memory_store()
    reset_memory_store()

    # Re-fetch orders from PostgreSQL
    check1 = (await client.get(f"/api/seller/orders/{ord1['id']}")).json()
    check2 = (await client.get(f"/api/seller/orders/{ord2['id']}")).json()
    check3 = (await client.get(f"/api/seller/orders/{ord3['id']}")).json()
    assert check1["lifecycle"] == "confirmed" and check1["actual_cod_minor"] == 800000
    assert check2["lifecycle"] == "confirmed" and check2["actual_cod_minor"] == 1000000
    assert check3["lifecycle"] == "cancelled"
    assert await connection.fetchval("SELECT count(*) FROM allocations") == 3
