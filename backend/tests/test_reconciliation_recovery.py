import datetime
import uuid

import pytest
from reconciliation_support import base_setup as base_setup  # noqa: F401
from reconciliation_support import clean_stores as clean_stores

from app.models.buyer import BuyerSubmission
from app.models.order import OrderInput
from app.models.transaction import ManualReceipt
from app.services.buyer_service import BuyerService
from app.services.order_service import OrderService, _memory_orders
from app.services.transaction_service import TransactionService


@pytest.mark.asyncio
async def test_reconciliation_recovery_scan_after_restart(base_setup):
    """
    AC39: Outage/restart mid-process or offline receipt import.
    reconcile_all_pending scans and recomputes matches safely.
    """
    from app.services.reconciliation import reconcile_all_pending

    shop_id = base_setup["shop_id"]
    owner_id = base_setup["owner_id"]
    acc_id = base_setup["account_id"]

    t0 = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=datetime.timezone.utc)
    t_pay = datetime.datetime(2026, 10, 24, 10, 5, 0, tzinfo=datetime.timezone.utc)
    t_claim = datetime.datetime(2026, 10, 24, 10, 10, 0, tzinfo=datetime.timezone.utc)

    order_svc = OrderService()
    ord1, _ = await order_svc.create_order(
        shop_id=shop_id, owner_id=owner_id,
        input_data=OrderInput(product_name="Product R", total_minor=200000, required_advance_minor=50000, payment_account_id=acc_id),
        idempotency_key=None,
    )
    _memory_orders[ord1.id]["created_at"] = t0

    # Buyer submits claim
    buyer_svc = BuyerService(clock=lambda: t_claim)
    await buyer_svc.submit_buyer_details(
        portal_token=ord1.portal_token,
        submission=BuyerSubmission(
            buyer_name="Restart User", contact_number="01711111111", address={"raw_text": "Dhaka"},
            payment_claim={"provider": "bkash", "trx_id": "RESTART-TRX", "sender_number": "01799999999", "amount_minor": 50000},
        ),
        idempotency_key="sub-restart-1",
    )
    # Order is pending
    assert _memory_orders[ord1.id]["lifecycle"] == "pending"

    # Simulate receipt was inserted into store without triggering reconciliation (e.g. offline import / restart)
    from app.services.transaction_store import _memory_observations, _memory_transactions
    tx_id = str(uuid.uuid4())
    _memory_transactions[tx_id] = {
        "id": tx_id,
        "shop_id": shop_id,
        "payment_account_id": acc_id,
        "provider": "bkash",
        "trx_id": "RESTART-TRX",
        "amount_minor": 50000,
        "sender_number_raw": "01799999999",
        "sender_number_canonical": "01799999999",
        "occurred_at": t_pay,
        "reconciliation_state": "unmatched",
        "has_conflict": False,
        "version": 1,
        "created_at": t_pay,
        "updated_at": t_pay,
    }
    _memory_observations[tx_id] = []

    # Run recovery scan
    confirmed_count = await reconcile_all_pending(None, shop_id=shop_id, clock=lambda: t_claim)
    assert confirmed_count == 1

    s_ord = await order_svc.get_order(shop_id, ord1.id)
    assert s_ord.lifecycle == "confirmed"
    assert s_ord.actual_cod_minor == 150000


@pytest.mark.asyncio
async def test_reconciliation_late_claim_alerts_seller_and_preserves_confirmation(base_setup):
    """
    AC21: Late claim arriving after order confirmed emits an audit alert on the confirmed order
    and marks the late claim with PAYMENT_USED, without reversing earlier confirmation.
    """
    from app.services.reconciliation_store import _memory_audit_events

    shop_id = base_setup["shop_id"]
    owner_id = base_setup["owner_id"]
    acc_id = base_setup["account_id"]

    t0 = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=datetime.timezone.utc)
    t_pay = datetime.datetime(2026, 10, 24, 10, 5, 0, tzinfo=datetime.timezone.utc)
    t_claim1 = datetime.datetime(2026, 10, 24, 10, 10, 0, tzinfo=datetime.timezone.utc)
    t_claim2 = datetime.datetime(2026, 10, 24, 10, 20, 0, tzinfo=datetime.timezone.utc)

    order_svc = OrderService()
    ord1, _ = await order_svc.create_order(
        shop_id=shop_id, owner_id=owner_id,
        input_data=OrderInput(product_name="Product Confirmed", total_minor=500000, required_advance_minor=100000, payment_account_id=acc_id),
        idempotency_key=None,
    )
    _memory_orders[ord1.id]["created_at"] = t0

    tx_svc = TransactionService()
    await tx_svc.record_manual_transaction(
        shop_id=shop_id, actor_id=owner_id,
        payload=ManualReceipt(
            payment_account_id=acc_id, provider="bkash", trx_id="ALERT-TRX-1",
            amount_minor=100000, sender_number="01811223344", occurred_at=t_pay,
        ),
    )

    buyer_svc1 = BuyerService(clock=lambda: t_claim1)
    await buyer_svc1.submit_buyer_details(
        portal_token=ord1.portal_token,
        submission=BuyerSubmission(
            buyer_name="First Buyer", contact_number="01711111111", address={"raw_text": "Dhaka"},
            payment_claim={"provider": "bkash", "trx_id": "ALERT-TRX-1", "sender_number": "01811223344", "amount_minor": 100000},
        ),
        idempotency_key="sub-alert-1",
    )

    # Order 1 is confirmed
    s1 = await order_svc.get_order(shop_id, ord1.id)
    assert s1.lifecycle == "confirmed"

    # Order 2 arrives later with same TrxID
    ord2, _ = await order_svc.create_order(
        shop_id=shop_id, owner_id=owner_id,
        input_data=OrderInput(product_name="Product Late", total_minor=400000, required_advance_minor=100000, payment_account_id=acc_id),
        idempotency_key=None,
    )
    _memory_orders[ord2.id]["created_at"] = t0

    buyer_svc2 = BuyerService(clock=lambda: t_claim2)
    await buyer_svc2.submit_buyer_details(
        portal_token=ord2.portal_token,
        submission=BuyerSubmission(
            buyer_name="Late Buyer", contact_number="01722222222", address={"raw_text": "Khulna"},
            payment_claim={"provider": "bkash", "trx_id": "ALERT-TRX-1", "sender_number": "01811223344", "amount_minor": 100000},
        ),
        idempotency_key="sub-alert-2",
    )

    # Order 2 remains pending with PAYMENT_USED
    s2 = await order_svc.get_order(shop_id, ord2.id)
    assert s2.lifecycle == "pending"
    assert "PAYMENT_USED" in s2.review_reasons

    # Order 1 remains confirmed
    s1_after = await order_svc.get_order(shop_id, ord1.id)
    assert s1_after.lifecycle == "confirmed"

    # Audit alert was emitted for order 1
    alert_event = next((e for e in _memory_audit_events if e["aggregate_id"] == ord1.id and e["action"] == "late_claim_alert"), None)
    assert alert_event is not None
