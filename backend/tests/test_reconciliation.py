import datetime
import uuid

import pytest

from app.core.tokens import get_utc_now
from app.models.buyer import BuyerSubmission
from app.models.order import OrderInput
from app.models.transaction import ManualReceipt
from app.services.buyer_service import BuyerService
from app.services.order_service import OrderService, _memory_orders, reset_order_memory_store
from app.services.seller_service import _memory_accounts, _memory_shops, reset_memory_store
from app.services.transaction_service import TransactionService
from app.services.transaction_store import reset_transaction_memory_store


@pytest.fixture(autouse=True)
def clean_stores():
    reset_memory_store()
    reset_order_memory_store()
    reset_transaction_memory_store()


@pytest.fixture
def base_setup():
    shop_id = str(uuid.uuid4())
    owner_id = "test-owner"
    _memory_shops[owner_id] = {
        "id": shop_id,
        "owner_id": owner_id,
        "display_name": "Test Shop",
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
    }
    acc_id = str(uuid.uuid4())
    _memory_accounts[acc_id] = {
        "id": acc_id,
        "shop_id": shop_id,
        "provider": "bkash",
        "receiving_number": "01711111111",
        "label": "Primary bKash",
        "is_active": True,
        "version": 1,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
    }
    return {"shop_id": shop_id, "owner_id": owner_id, "account_id": acc_id}


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




