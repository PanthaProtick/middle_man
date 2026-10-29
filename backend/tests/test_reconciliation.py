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
async def test_reconciliation_seller_receipt_first_then_buyer_claim(base_setup):
    """
    AC12 & AC16: Seller records valid received payment first.
    Buyer then submits claim with matching provider, account, TrxID, sender, exact advance.
    Reconciliation runs and immediately confirms order with actual COD and automatic basis.
    """
    shop_id = base_setup["shop_id"]
    owner_id = base_setup["owner_id"]
    acc_id = base_setup["account_id"]

    t0 = datetime.datetime(2026, 10, 24, 10, 0, 0, tzinfo=datetime.timezone.utc)
    t_pay = datetime.datetime(2026, 10, 24, 10, 5, 0, tzinfo=datetime.timezone.utc)
    t_claim = datetime.datetime(2026, 10, 24, 10, 10, 0, tzinfo=datetime.timezone.utc)

    order_svc = OrderService()
    # Inject t0 for order creation
    created_order, _ = await order_svc.create_order(
        shop_id=shop_id,
        owner_id=owner_id,
        input_data=OrderInput(
            product_name="Silk Saree",
            total_minor=500000,          # 5000 BDT
            required_advance_minor=100000, # 1000 BDT advance, 4000 BDT expected COD
            payment_account_id=acc_id,
        ),
        idempotency_key=None,
    )
    # Adjust created_at for deterministic time interval test
    _memory_orders[created_order.id]["created_at"] = t0

    # 1. Seller records receipt at t_pay
    tx_svc = TransactionService()
    receipt, code = await tx_svc.record_manual_transaction(
        shop_id=shop_id,
        actor_id=owner_id,
        payload=ManualReceipt(
            payment_account_id=acc_id,
            provider="bkash",
            trx_id="TRX123456",
            amount_minor=100000,
            sender_number="01811223344",
            occurred_at=t_pay,
        ),
    )
    assert code in (200, 201)

    # 2. Buyer submits matching claim at t_claim
    buyer_svc = BuyerService(clock=lambda: t_claim)
    submission = BuyerSubmission(
        buyer_name="Rahim Khan",
        contact_number="01799887766",
        address={"raw_text": "House 1, Road 2, Dhanmondi, Dhaka"},
        payment_claim={
            "provider": "bkash",
            "trx_id": "TRX123456",
            "sender_number": "01811223344",
            "amount_minor": 100000,
        },
    )

    public_order, sub_code = await buyer_svc.submit_buyer_details(
        portal_token=created_order.portal_token,
        submission=submission,
        idempotency_key="sub-key-1",
    )
    assert sub_code == 200

    # Observable result on PublicOrder: confirmed and actual COD is 400000 minor units
    assert public_order.lifecycle == "confirmed"
    assert public_order.actual_cod_minor == 400000
    assert public_order.expected_cod_minor == 400000

    # Observable result on SellerOrder: confirmed, actual COD, allocation_basis="automatic", review_reasons empty
    seller_order = await order_svc.get_order(shop_id, created_order.id)
    assert seller_order.lifecycle == "confirmed"
    assert seller_order.actual_cod_minor == 400000
    assert seller_order.allocation_basis == "automatic"
    assert seller_order.review_reasons == []


@pytest.mark.asyncio
async def test_reconciliation_buyer_claim_first_then_seller_receipt(base_setup):
    """
    AC16: Reverse arrival order. Buyer submits claim first (becomes pending).
    Seller then records qualifying receipt.
    Reconciliation runs on receipt recording and confirms the pending order.
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
            product_name="Cotton Kurti",
            total_minor=300000,
            required_advance_minor=50000,
            payment_account_id=acc_id,
        ),
        idempotency_key=None,
    )
    _memory_orders[created_order.id]["created_at"] = t0

    # 1. Buyer submits claim first
    buyer_svc = BuyerService(clock=lambda: t_claim)
    submission = BuyerSubmission(
        buyer_name="Anisur Rahman",
        contact_number="01711223344",
        address={"raw_text": "Gulshan-1, Dhaka"},
        payment_claim={
            "provider": "bkash",
            "trx_id": "REVERSE999",
            "sender_number": "01988776655",
            "amount_minor": 50000,
        },
    )

    public_order, sub_code = await buyer_svc.submit_buyer_details(
        portal_token=created_order.portal_token,
        submission=submission,
        idempotency_key="sub-key-rev",
    )
    assert sub_code == 200
    # Before receipt arrives, order is pending
    assert public_order.lifecycle == "pending"
    assert public_order.actual_cod_minor is None
    assert public_order.expected_cod_minor == 250000

    # 2. Seller records receipt
    tx_svc = TransactionService()
    receipt, code = await tx_svc.record_manual_transaction(
        shop_id=shop_id,
        actor_id=owner_id,
        payload=ManualReceipt(
            payment_account_id=acc_id,
            provider="bkash",
            trx_id="REVERSE999",
            amount_minor=50000,
            sender_number="01988776655",
            occurred_at=t_pay,
        ),
    )
    assert code in (200, 201)

    # Observable result on SellerOrder after receipt arrival: confirmed
    seller_order = await order_svc.get_order(shop_id, created_order.id)
    assert seller_order.lifecycle == "confirmed"
    assert seller_order.actual_cod_minor == 250000
    assert seller_order.allocation_basis == "automatic"
    assert seller_order.review_reasons == []

    # Observable result on buyer public lookup: confirmed and actual COD visible
    refreshed_public = await buyer_svc.get_public_order(created_order.portal_token)
    assert refreshed_public.lifecycle == "confirmed"
    assert refreshed_public.actual_cod_minor == 250000


@pytest.mark.asyncio
async def test_reconciliation_bangla_digits_and_separate_contact_and_sender(base_setup):
    """
    AC07 & AC08: Contact number differs from payment sender.
    Bangla digits in sender are canonicalized and match full canonical sender.
    Exact automatic confirmation occurs.
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
            product_name="Product Bangla",
            total_minor=500000,
            required_advance_minor=100000,
            payment_account_id=acc_id,
        ),
        idempotency_key=None,
    )
    _memory_orders[created_order.id]["created_at"] = t0

    # Seller records receipt with english phone
    tx_svc = TransactionService()
    await tx_svc.record_manual_transaction(
        shop_id=shop_id,
        actor_id=owner_id,
        payload=ManualReceipt(
            payment_account_id=acc_id,
            provider="bkash",
            trx_id="TRX-BANGLA-1",
            amount_minor=100000,
            sender_number="01711223344",
            occurred_at=t_pay,
        ),
    )

    # Buyer submits claim with bangla phone for payment sender and a completely different contact number
    buyer_svc = BuyerService(clock=lambda: t_claim)
    pub, _ = await buyer_svc.submit_buyer_details(
        portal_token=created_order.portal_token,
        submission=BuyerSubmission(
            buyer_name="Fatima Begum",
            contact_number="০১৭১৯৯৯৮৮৭৭", # completely different contact number
            address={"raw_text": "Sylhet Sadar"},
            payment_claim={
                "provider": "bkash",
                "trx_id": "TRX-BANGLA-1",
                "sender_number": "০১৭১১২২৩৩৪৪", # Bangla representation of 01711223344!
                "amount_minor": 100000,
            },
        ),
        idempotency_key="sub-bangla",
    )
    assert pub.lifecycle == "confirmed"
    assert pub.actual_cod_minor == 400000
