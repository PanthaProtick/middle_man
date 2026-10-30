import hashlib
import json
from typing import Literal, Optional

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.buyer import clean_trx_id
from app.models.entities import BuyerRevisionTable, OrderTable, ReceivedTransactionTable
from app.models.review_assistance import (
    ReviewAction,
    ReviewAssistanceResponse,
    ReviewCondition,
    ReviewFacts,
    SuggestedAction,
)
from app.services.buyer_service import _memory_buyer_revisions
from app.services.order_service import _memory_orders
from app.services.reconciliation import get_order_review_reasons
from app.services.retention_access import require_retained_record, unavailable_record
from app.services.seller_service import NotFoundError, SellerDomainException
from app.services.transaction_store import _memory_transactions


class IneligibleLifecycleError(SellerDomainException):
    def __init__(self, message: str = "Review assistance is only available for pending orders") -> None:
        super().__init__(status.HTTP_409_CONFLICT, "INVALID_LIFECYCLE", message)


_CONDITIONS_TEXT: dict[str, dict[str, str]] = {
    "NO_RECORDED_RECEIPT": {
        "en": (
            "No matching seller transaction record was found for this payment claim. "
            "This does not mean the buyer did not pay; the payment receipt may not have been imported or recorded yet."
        ),
        "bn": (
            "এই পেমেন্ট দাবির সাথে মিল থাকা কোনো বিক্রেতা লেনদেন রেকর্ড পাওয়া যায়নি। "
            "এর মানে এই নয় যে ক্রেতা অর্থ প্রদান করেননি; পেমেন্ট রসিদটি এখনও আমদানি বা রেকর্ড করা নাও হতে পারে।"
        ),
    },
    "UNKNOWN_CAUSE": {
        "en": (
            "This order is pending review for an unknown reason. "
            "No specific review reason code or missing receipt condition was detected."
        ),
        "bn": (
            "এই অর্ডারটি একটি অজানা কারণে পর্যালোচনার জন্য অপেক্ষমাণ রয়েছে। "
            "কোনো সুনির্দিষ্ট পর্যালোচনা কারণ কোড বা অনুপস্থিত রসিদ শনাক্ত করা যায়নি।"
        ),
    },
    "UNSUPPORTED_REASON_CODE": {
        "en": (
            "This order has pending review reasons that require manual verification. "
            "Specific automated review assistance for these reasons is not available yet."
        ),
        "bn": (
            "এই অর্ডারে পর্যালোচনার জন্য অপেক্ষমাণ কারণ রয়েছে যা ম্যানুয়ালি যাচাই করা প্রয়োজন। "
            "এই কারণগুলির জন্য নির্দিষ্ট স্বয়ংক্রিয় সহায়তা এখনও উপলব্ধ নেই।"
        ),
    },
}

_ACTIONS_TEXT: dict[str, dict[str, str]] = {
    "CHECK_TRANSACTIONS": {
        "en": "Check transactions",
        "bn": "লেনদেন পরীক্ষা করুন",
    },
    "CORRECT_BUYER_DETAILS": {
        "en": "Correct buyer details",
        "bn": "ক্রেতার তথ্য সংশোধন করুন",
    },
}


def _make_actions(action_ids: list[ReviewAction], language: Literal["en", "bn"]) -> list[SuggestedAction]:
    actions: list[SuggestedAction] = []
    for aid in action_ids:
        label = _ACTIONS_TEXT.get(aid, {}).get(language, aid)
        target: Literal["transactions", "buyer_tab"] = "transactions" if aid == "CHECK_TRANSACTIONS" else "buyer_tab"
        actions.append(SuggestedAction(action_id=aid, label=label, target=target))
    return actions


async def get_review_assistance(
    db: Optional[AsyncSession],
    shop_id: str,
    order_id: str,
    language: Literal["en", "bn"] = "en",
    receipt_id: Optional[str] = None,
) -> ReviewAssistanceResponse:
    if db is not None:
        order = (await db.execute(
            select(OrderTable).where(OrderTable.id == order_id, OrderTable.shop_id == shop_id)
        )).scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found")
        require_retained_record(order)
        order_version = order.version
        buyer_rev_num = order.buyer_revision
        lifecycle = order.lifecycle
    else:
        raw_order = _memory_orders.get(order_id)
        if not raw_order or raw_order.get("shop_id") != shop_id:
            raise NotFoundError("Order not found")
        require_retained_record(raw_order)
        order_version = int(raw_order.get("version", 1))
        buyer_rev_num = raw_order.get("buyer_revision")
        lifecycle = str(raw_order.get("lifecycle", ""))

    if lifecycle != "pending" or buyer_rev_num is None:
        raise IneligibleLifecycleError("Review assistance is only available for pending orders")

    selected_version: Optional[int] = None
    if receipt_id:
        if db is not None:
            receipt = (await db.execute(
                select(ReceivedTransactionTable).where(
                    ReceivedTransactionTable.id == receipt_id,
                    ReceivedTransactionTable.shop_id == shop_id,
                )
            )).scalar_one_or_none()
            if not receipt:
                raise NotFoundError("Transaction receipt not found")
            if receipt.retained_at:
                raise unavailable_record()
            selected_version = receipt.version
        else:
            tx = _memory_transactions.get(receipt_id)
            if not tx or tx.get("shop_id") != shop_id:
                raise NotFoundError("Transaction receipt not found")
            if tx.get("retained_at"):
                raise unavailable_record()
            selected_version = int(tx.get("version", 1))

    review_reasons = await get_order_review_reasons(db, order_id)

    provider: Optional[str] = None
    trx_id: Optional[str] = None

    if db is not None:
        if buyer_rev_num is not None:
            rev_row = (await db.execute(
                select(BuyerRevisionTable).where(
                    BuyerRevisionTable.order_id == order_id,
                    BuyerRevisionTable.revision_number == buyer_rev_num,
                )
            )).scalar_one_or_none()
            if rev_row:
                provider = rev_row.payment_provider
                trx_id = rev_row.payment_trx_id
    else:
        rev_list = _memory_buyer_revisions.get(order_id, [])
        last_rev = next((rev for rev in rev_list if rev.get("revision_number") == buyer_rev_num), None)
        if last_rev:
            provider = last_rev.get("payment_provider")
            trx_id = last_rev.get("payment_trx_id")

    has_receipt = False
    matching_version: Optional[int] = None
    if provider and trx_id:
        c_trx = clean_trx_id(trx_id)
        if db is not None:
            cand = (await db.execute(
                select(ReceivedTransactionTable).where(
                    ReceivedTransactionTable.shop_id == shop_id,
                    ReceivedTransactionTable.retained_at.is_(None),
                    ReceivedTransactionTable.provider == provider,
                    ReceivedTransactionTable.trx_id == c_trx,
                )
            )).scalar_one_or_none()
            has_receipt = cand is not None
            matching_version = cand.version if cand else None
        else:
            matching = next((tx for tx in _memory_transactions.values()
                if tx.get("shop_id") == shop_id
                and not tx.get("retained_at")
                and tx.get("provider") == provider
                and clean_trx_id(tx.get("trx_id", "")) == c_trx), None)
            has_receipt = matching is not None
            matching_version = int(matching.get("version", 1)) if matching else None

    condition: ReviewCondition
    action_ids: list[ReviewAction]
    if review_reasons:
        condition = "UNSUPPORTED_REASON_CODE"
        action_ids = ["CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS"]
    elif provider and trx_id and not has_receipt:
        condition = "NO_RECORDED_RECEIPT"
        action_ids = ["CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS"]
    else:
        condition = "UNKNOWN_CAUSE"
        action_ids = ["CHECK_TRANSACTIONS"]

    # Opaque, content-free identity; locale changes do not change business context.
    context_token = hashlib.sha256(json.dumps([
        shop_id, order_id, order_version, buyer_rev_num, lifecycle, provider, trx_id,
        sorted(review_reasons), has_receipt, matching_version, receipt_id, selected_version,
    ]).encode()).hexdigest()

    explanation = _CONDITIONS_TEXT[condition][language]
    suggested_actions = _make_actions(action_ids, language)

    if db is not None:
        # The local builder has await points: reject a concurrent order change
        # instead of returning facts labelled with an obsolete order version.
        assert order is not None
        await db.refresh(order)
        require_retained_record(order)
        if (order.version, order.buyer_revision, order.lifecycle) != (order_version, buyer_rev_num, lifecycle):
            raise SellerDomainException(409, "REVIEW_CHANGED", "Review changed. Refresh the order.")

    return ReviewAssistanceResponse(
        order_id=order_id,
        order_version=order_version,
        buyer_revision=buyer_rev_num,
        lifecycle="pending",
        source="local",
        condition=condition,
        context_token=context_token,
        reason_codes=list(review_reasons),
        explanation=explanation,
        suggested_actions=suggested_actions,
        facts=ReviewFacts(has_matching_receipt=has_receipt),
        locale=language,
    )
