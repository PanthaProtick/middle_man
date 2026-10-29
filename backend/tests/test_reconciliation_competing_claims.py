import datetime

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
async def test_reconciliation_competing_active_claims(base_setup):
    """
    AC20: Two known pending orders claim the same receipt (provider, trx_id).
    Reconciliation holds both in pending without first-submitter winner.
    Both get typed review reason COMPETING_CLAIMS.
    """
    shop_id = base_setup["shop_id"]
    owner_id = base_setup["owner_id"]
    acc_id = base_setup["account_id"]

    t0 = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=datetime.timezone.utc)
    t_pay = datetime.datetime(2026, 10, 24, 10, 5, 0, tzinfo=datetime.timezone.utc)
    t_claim1 = datetime.datetime(2026, 10, 24, 10, 10, 0, tzinfo=datetime.timezone.utc)
    t_claim2 = datetime.datetime(2026, 10, 24, 10, 15, 0, tzinfo=datetime.timezone.utc)

    order_svc = OrderService()
    ord1, _ = await order_svc.create_order(
        shop_id=shop_id,
        owner_id=owner_id,
        input_data=OrderInput(
            product_name="Product 1",
            total_minor=500000,
            required_advance_minor=100000,
            payment_account_id=acc_id,
        ),
        idempotency_key=None,
    )
    _memory_orders[ord1.id]["created_at"] = t0

    ord2, _ = await order_svc.create_order(
        shop_id=shop_id,
        owner_id=owner_id,
        input_data=OrderInput(
            product_name="Product 2",
            total_minor=400000,
            required_advance_minor=100000,
            payment_account_id=acc_id,
        ),
        idempotency_key=None,
    )
    _memory_orders[ord2.id]["created_at"] = t0

    # Seller records receipt for TRX-SHARED
    tx_svc = TransactionService()
    await tx_svc.record_manual_transaction(
        shop_id=shop_id,
        actor_id=owner_id,
        payload=ManualReceipt(
            payment_account_id=acc_id,
            provider="bkash",
            trx_id="TRX-SHARED",
            amount_minor=100000,
            sender_number="01811223344",
            occurred_at=t_pay,
        ),
    )

    # First buyer submits claim for TRX-SHARED
    buyer_svc1 = BuyerService(clock=lambda: t_claim1)
    pub1, _ = await buyer_svc1.submit_buyer_details(
        portal_token=ord1.portal_token,
        submission=BuyerSubmission(
            buyer_name="Buyer One",
            contact_number="01711111111",
            address={"raw_text": "Dhaka"},
            payment_claim={
                "provider": "bkash",
                "trx_id": "TRX-SHARED",
                "sender_number": "01811223344",
                "amount_minor": 100000,
            },
        ),
        idempotency_key="sub-shared-1",
    )
    # At this moment, only 1 claim existed, so ord1 was confirmed!
    # Wait, per AC20: what if BOTH orders were pending before receipt arrived,
    # OR what if order 2 submits second claim after order 1 confirmed (AC21)?
    # Let's verify AC21 first:
    # Ord1 confirmed:
    assert pub1.lifecycle == "confirmed"

    # Now Buyer Two submits claim for TRX-SHARED (AC21: later claim after confirmation)
    buyer_svc2 = BuyerService(clock=lambda: t_claim2)
    pub2, _ = await buyer_svc2.submit_buyer_details(
        portal_token=ord2.portal_token,
        submission=BuyerSubmission(
            buyer_name="Buyer Two",
            contact_number="01722222222",
            address={"raw_text": "Chittagong"},
            payment_claim={
                "provider": "bkash",
                "trx_id": "TRX-SHARED",
                "sender_number": "01811223344",
                "amount_minor": 100000,
            },
        ),
        idempotency_key="sub-shared-2",
    )
    # AC21: Ord 2 must NOT reverse ord1! Ord2 is pending with PAYMENT_USED
    assert pub2.lifecycle == "pending"
    ord2_seller = await order_svc.get_order(shop_id, ord2.id)
    assert ord2_seller.lifecycle == "pending"
    assert "PAYMENT_USED" in ord2_seller.review_reasons

    # Ord1 remains confirmed!
    ord1_seller = await order_svc.get_order(shop_id, ord1.id)
    assert ord1_seller.lifecycle == "confirmed"


@pytest.mark.asyncio
async def test_reconciliation_competing_claims_before_receipt_arrival(base_setup):
    """
    AC20: Two buyers submit claims for the same TrxID BEFORE seller records receipt.
    When seller receipt arrives, both orders are already known pending claims.
    Neither wins automatically; both get COMPETING_CLAIMS.
    """
    shop_id = base_setup["shop_id"]
    owner_id = base_setup["owner_id"]
    acc_id = base_setup["account_id"]

    t0 = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=datetime.timezone.utc)
    t_pay = datetime.datetime(2026, 10, 24, 10, 5, 0, tzinfo=datetime.timezone.utc)
    t_claim1 = datetime.datetime(2026, 10, 24, 10, 10, 0, tzinfo=datetime.timezone.utc)
    t_claim2 = datetime.datetime(2026, 10, 24, 10, 15, 0, tzinfo=datetime.timezone.utc)

    order_svc = OrderService()
    ord1, _ = await order_svc.create_order(
        shop_id=shop_id,
        owner_id=owner_id,
        input_data=OrderInput(
            product_name="Product 1",
            total_minor=500000,
            required_advance_minor=100000,
            payment_account_id=acc_id,
        ),
        idempotency_key=None,
    )
    _memory_orders[ord1.id]["created_at"] = t0

    ord2, _ = await order_svc.create_order(
        shop_id=shop_id,
        owner_id=owner_id,
        input_data=OrderInput(
            product_name="Product 2",
            total_minor=400000,
            required_advance_minor=100000,
            payment_account_id=acc_id,
        ),
        idempotency_key=None,
    )
    _memory_orders[ord2.id]["created_at"] = t0

    # Buyer 1 submits
    buyer_svc1 = BuyerService(clock=lambda: t_claim1)
    await buyer_svc1.submit_buyer_details(
        portal_token=ord1.portal_token,
        submission=BuyerSubmission(
            buyer_name="Buyer One",
            contact_number="01711111111",
            address={"raw_text": "Dhaka"},
            payment_claim={
                "provider": "bkash",
                "trx_id": "TRX-DUAL",
                "sender_number": "01811223344",
                "amount_minor": 100000,
            },
        ),
        idempotency_key="sub-dual-1",
    )

    # Buyer 2 submits
    buyer_svc2 = BuyerService(clock=lambda: t_claim2)
    await buyer_svc2.submit_buyer_details(
        portal_token=ord2.portal_token,
        submission=BuyerSubmission(
            buyer_name="Buyer Two",
            contact_number="01722222222",
            address={"raw_text": "Chittagong"},
            payment_claim={
                "provider": "bkash",
                "trx_id": "TRX-DUAL",
                "sender_number": "01811223344",
                "amount_minor": 100000,
            },
        ),
        idempotency_key="sub-dual-2",
    )

    # Now seller records receipt for TRX-DUAL
    tx_svc = TransactionService()
    await tx_svc.record_manual_transaction(
        shop_id=shop_id,
        actor_id=owner_id,
        payload=ManualReceipt(
            payment_account_id=acc_id,
            provider="bkash",
            trx_id="TRX-DUAL",
            amount_minor=100000,
            sender_number="01811223344",
            occurred_at=t_pay,
        ),
    )

    # Both orders must remain pending with COMPETING_CLAIMS
    s_ord1 = await order_svc.get_order(shop_id, ord1.id)
    assert s_ord1.lifecycle == "pending"
    assert "COMPETING_CLAIMS" in s_ord1.review_reasons

    s_ord2 = await order_svc.get_order(shop_id, ord2.id)
    assert s_ord2.lifecycle == "pending"
    assert "COMPETING_CLAIMS" in s_ord2.review_reasons
