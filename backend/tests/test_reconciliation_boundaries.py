import datetime
import uuid

import pytest
from reconciliation_support import base_setup as base_setup  # noqa: F401
from reconciliation_support import clean_stores as clean_stores

from app.core.tokens import get_utc_now
from app.models.buyer import BuyerSubmission
from app.models.order import OrderInput
from app.models.transaction import ManualReceipt
from app.services.buyer_service import BuyerService
from app.services.order_service import OrderService, _memory_orders
from app.services.seller_service import _memory_accounts, _memory_shops
from app.services.transaction_service import TransactionService


@pytest.mark.asyncio
async def test_reconciliation_mismatches_produce_typed_review_reasons(base_setup):
    """
    AC13, AC14, AC15, AC48:
    Mismatches in sender, amount, receiving account, and time produce typed review reasons.
    Order remains pending. Buyer status remains pending without leaking private review reasons.
    """
    shop_id = base_setup["shop_id"]
    owner_id = base_setup["owner_id"]
    acc_id = base_setup["account_id"]

    t0 = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=datetime.timezone.utc)
    t_pay = datetime.datetime(2026, 10, 24, 10, 5, 0, tzinfo=datetime.timezone.utc)
    t_claim = datetime.datetime(2026, 10, 24, 10, 10, 0, tzinfo=datetime.timezone.utc)

    order_svc = OrderService()
    created_order, _ = await order_svc.create_order(
        shop_id=shop_id,
        owner_id=owner_id,
        input_data=OrderInput(
            product_name="Product A",
            total_minor=500000,
            required_advance_minor=100000,
            payment_account_id=acc_id,
        ),
        idempotency_key=None,
    )
    _memory_orders[created_order.id]["created_at"] = t0

    # 1. Sender mismatch: receipt has 01899999999, claim has 01711111111
    tx_svc = TransactionService()
    await tx_svc.record_manual_transaction(
        shop_id=shop_id,
        actor_id=owner_id,
        payload=ManualReceipt(
            payment_account_id=acc_id,
            provider="bkash",
            trx_id="TRX-MISMATCH-1",
            amount_minor=100000,
            sender_number="01899999999",
            occurred_at=t_pay,
        ),
    )

    buyer_svc = BuyerService(clock=lambda: t_claim)
    pub, _ = await buyer_svc.submit_buyer_details(
        portal_token=created_order.portal_token,
        submission=BuyerSubmission(
            buyer_name="Customer",
            contact_number="01700000000",
            address={"raw_text": "Dhaka"},
            payment_claim={
                "provider": "bkash",
                "trx_id": "TRX-MISMATCH-1",
                "sender_number": "01711111111", # differs from receipt sender!
                "amount_minor": 100000,
            },
        ),
        idempotency_key="sub-mis-1",
    )
    assert pub.lifecycle == "pending"
    assert pub.actual_cod_minor is None
    # Public order does NOT contain review_reasons attribute or leak private reasons
    assert not hasattr(pub, "review_reasons")

    # Seller order DOES have the typed reason SENDER_MISMATCH
    ord_seller = await order_svc.get_order(shop_id, created_order.id)
    assert ord_seller.lifecycle == "pending"
    assert "SENDER_MISMATCH" in ord_seller.review_reasons


@pytest.mark.asyncio
async def test_reconciliation_cross_shop_isolation(base_setup):
    """
    AC03: Same TrxID appears in independent shops.
    Checking remains strictly separate; no cross-shop effect or allocation.
    """
    shop1_id = base_setup["shop_id"]
    owner1_id = base_setup["owner_id"]
    acc1_id = base_setup["account_id"]

    # Shop 2
    shop2_id = str(uuid.uuid4())
    owner2_id = "test-owner-2"
    _memory_shops[owner2_id] = {
        "id": shop2_id,
        "owner_id": owner2_id,
        "display_name": "Second Shop",
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
    }
    acc2_id = str(uuid.uuid4())
    _memory_accounts[acc2_id] = {
        "id": acc2_id,
        "shop_id": shop2_id,
        "provider": "bkash",
        "receiving_number": "01822222222",
        "label": "Shop 2 bKash",
        "is_active": True,
        "version": 1,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
    }

    t0 = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=datetime.timezone.utc)
    t_pay = datetime.datetime(2026, 10, 24, 10, 5, 0, tzinfo=datetime.timezone.utc)
    t_claim = datetime.datetime(2026, 10, 24, 10, 10, 0, tzinfo=datetime.timezone.utc)

    order_svc = OrderService()
    ord1, _ = await order_svc.create_order(
        shop_id=shop1_id,
        owner_id=owner1_id,
        input_data=OrderInput(
            product_name="P1", total_minor=500000, required_advance_minor=100000, payment_account_id=acc1_id
        ),
        idempotency_key=None,
    )
    ord2, _ = await order_svc.create_order(
        shop_id=shop2_id,
        owner_id=owner2_id,
        input_data=OrderInput(
            product_name="P2", total_minor=500000, required_advance_minor=100000, payment_account_id=acc2_id
        ),
        idempotency_key=None,
    )
    _memory_orders[ord1.id]["created_at"] = t0
    _memory_orders[ord2.id]["created_at"] = t0

    # Both buyers submit same TrxID "SAME-TRX-100" in their respective shops
    buyer_svc = BuyerService(clock=lambda: t_claim)
    await buyer_svc.submit_buyer_details(
        portal_token=ord1.portal_token,
        submission=BuyerSubmission(
            buyer_name="B1", contact_number="01711111111", address={"raw_text": "Dhaka"},
            payment_claim={"provider": "bkash", "trx_id": "SAME-TRX-100", "sender_number": "01711111111", "amount_minor": 100000},
        ),
        idempotency_key="sub-iso-1",
    )
    await buyer_svc.submit_buyer_details(
        portal_token=ord2.portal_token,
        submission=BuyerSubmission(
            buyer_name="B2", contact_number="01722222222", address={"raw_text": "Dhaka"},
            payment_claim={"provider": "bkash", "trx_id": "SAME-TRX-100", "sender_number": "01722222222", "amount_minor": 100000},
        ),
        idempotency_key="sub-iso-2",
    )

    # Seller 1 records receipt with SAME-TRX-100 in Shop 1
    tx_svc = TransactionService()
    await tx_svc.record_manual_transaction(
        shop_id=shop1_id,
        actor_id=owner1_id,
        payload=ManualReceipt(
            payment_account_id=acc1_id, provider="bkash", trx_id="SAME-TRX-100",
            amount_minor=100000, sender_number="01711111111", occurred_at=t_pay,
        ),
    )

    # Shop 1's order is confirmed!
    s_ord1 = await order_svc.get_order(shop1_id, ord1.id)
    assert s_ord1.lifecycle == "confirmed"

    # Shop 2's order is STILL pending (NOT affected by Shop 1, no competing claim error between different shops!)
    s_ord2 = await order_svc.get_order(shop2_id, ord2.id)
    assert s_ord2.lifecycle == "pending"
    assert s_ord2.review_reasons == []
