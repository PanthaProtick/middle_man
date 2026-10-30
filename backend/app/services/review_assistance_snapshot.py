"""Shop-scoped loading of authoritative records for review assistance."""
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.buyer import clean_trx_id
from app.models.entities import (
    BuyerRevisionTable,
    OrderTable,
    ReceivedTransactionTable,
)
from app.models.payment_decision import PaymentPreview
from app.models.transaction import ReceiptView
from app.services.buyer_service import _memory_buyer_revisions
from app.services.order_service import _memory_orders
from app.services.payment_preview import payment_preview
from app.services.receipt_comparison import compare_receipt
from app.services.reconciliation import get_order_review_reasons
from app.services.retention_access import require_retained_record, unavailable_record
from app.services.review_assistance_context import (
    ClaimPaymentSnapshot,
    ClaimSnapshot,
    ObservationSnapshot,
    OrderSnapshot,
    ReceiptSnapshot,
)
from app.services.review_assistance_freshness import (
    comparison_signature,
    iso,
    receipt_allocation_ids,
    receipt_signature,
    used_marker_present,
)
from app.services.seller_service import NotFoundError, SellerDomainException
from app.services.transaction_store import _memory_transactions


class IneligibleLifecycleError(SellerDomainException):
    def __init__(self, message: str = "Review assistance is only available for pending orders") -> None:
        super().__init__(status.HTTP_409_CONFLICT, "INVALID_LIFECYCLE", message)


@dataclass(frozen=True)
class AssistanceSnapshot:
    order_id: str
    order_version: int
    buyer_revision: int
    lifecycle: str
    order: OrderSnapshot
    claim: ClaimPaymentSnapshot
    provider: Optional[str]
    trx_id: Optional[str]
    claim_identity_present: bool
    receipt: Optional[ReceiptSnapshot]
    claims: tuple[ClaimSnapshot, ...]
    allocated: bool
    used_marker_present: bool
    stored_reasons: tuple[str, ...]
    selected_version: Optional[int]
    freshness: tuple[Any, ...]
    preview: Optional[PaymentPreview]


async def load_assistance_snapshot(
    db: Optional[AsyncSession],
    shop_id: str,
    order_id: str,
    receipt_id: Optional[str] = None,
) -> AssistanceSnapshot:
    if db is not None:
        order = (await db.execute(
            select(OrderTable).where(OrderTable.id == order_id, OrderTable.shop_id == shop_id)
            .execution_options(populate_existing=True)
        )).scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found")
        require_retained_record(order)
        order_version = order.version
        buyer_rev_num = order.buyer_revision
        lifecycle = order.lifecycle
        order_snapshot = OrderSnapshot(
            payment_account_id=str(order.payment_account_id),
            required_advance_minor=int(order.required_advance_minor),
            created_at=order.created_at,
        )
    else:
        raw_order = _memory_orders.get(order_id)
        if not raw_order or raw_order.get("shop_id") != shop_id:
            raise NotFoundError("Order not found")
        require_retained_record(raw_order)
        order_version = int(raw_order.get("version", 1))
        buyer_rev_num = raw_order.get("buyer_revision")
        lifecycle = str(raw_order.get("lifecycle", ""))
        order_snapshot = OrderSnapshot(
            payment_account_id=str(raw_order["payment_account_id"]),
            required_advance_minor=int(raw_order["required_advance_minor"]),
            created_at=raw_order["created_at"],
        )

    if lifecycle != "pending" or buyer_rev_num is None:
        raise IneligibleLifecycleError()

    selected_version = await _selected_receipt_version(db, shop_id, receipt_id)
    stored_reasons = tuple(sorted(await get_order_review_reasons(db, order_id)))
    revision = await _load_revision(db, order_id, buyer_rev_num)
    provider = revision.get("payment_provider")
    trx_id = revision.get("payment_trx_id")
    claim = ClaimPaymentSnapshot(
        amount_minor=int(revision.get("payment_amount_minor") or 0),
        sender_canonical=revision.get("payment_sender_canonical"),
        submitted_at=revision.get("claim_accepted_at") or order_snapshot.created_at,
    )

    preview = await payment_preview(db, shop_id, order_id, receipt_id, read_only=True) if receipt_id else None
    if preview and (preview.expected_version != order_version or
                    preview.expected_transaction_version != selected_version):
        raise SellerDomainException(409, "REVIEW_CHANGED", "Review changed. Refresh the order.")
    receipt_row = ({"id": preview.receipt.id, "provider": preview.receipt.provider,
                    "trx_id": preview.receipt.trx_id} if preview else
                   await _matching_receipt(db, shop_id, provider, trx_id))
    receipt: Optional[ReceiptSnapshot] = None
    claims: tuple[ClaimSnapshot, ...] = ()
    allocated = False
    allocation_ids: list[str] = []
    marker_present = False
    comparison_fingerprint: tuple[Any, ...] = ()
    if receipt_row is not None:
        comparison = await compare_receipt(db, shop_id, receipt_row["id"])
        receipt = _receipt_snapshot(comparison.receipt)
        claims = tuple(ClaimSnapshot(
            order_id=claim_item.order_id,
            revision_id=claim_item.revision_id,
            lifecycle=claim_item.lifecycle,
            held_by_resolution=claim_item.held_by_resolution,
        ) for claim_item in comparison.claims)
        allocated = comparison.allocated_order_id is not None
        allocation_ids = await receipt_allocation_ids(db, shop_id, receipt_row["id"])
        marker_present = await used_marker_present(
            db, shop_id, receipt_row["id"], receipt_row["provider"], receipt_row["trx_id"],
        )
        comparison_fingerprint = comparison_signature(comparison)

    freshness = (
        shop_id, order_id, order_version, buyer_rev_num, lifecycle,
        revision.get("id"), provider, trx_id, claim.amount_minor,
        claim.sender_canonical, iso(claim.submitted_at), stored_reasons,
        receipt_row["id"] if receipt_row else None,
        receipt_signature(receipt),
        comparison_fingerprint,
        tuple(allocation_ids), marker_present, allocated,
        tuple(sorted((item.order_id, item.revision_id, item.lifecycle, item.held_by_resolution)
                     for item in claims)),
        receipt_id, selected_version,
        preview.model_dump_json() if preview else None,
    )
    return AssistanceSnapshot(
        order_id=order_id,
        order_version=order_version,
        buyer_revision=int(buyer_rev_num),
        lifecycle=lifecycle,
        order=order_snapshot,
        claim=claim,
        provider=provider,
        trx_id=trx_id,
        claim_identity_present=bool(provider and trx_id),
        receipt=receipt,
        claims=claims,
        allocated=allocated,
        used_marker_present=marker_present,
        stored_reasons=stored_reasons,
        selected_version=selected_version,
        freshness=freshness,
        preview=preview,
    )


async def _selected_receipt_version(
    db: Optional[AsyncSession], shop_id: str, receipt_id: Optional[str],
) -> Optional[int]:
    if not receipt_id:
        return None
    if db is not None:
        receipt = (await db.execute(select(ReceivedTransactionTable).where(
            ReceivedTransactionTable.id == receipt_id,
            ReceivedTransactionTable.shop_id == shop_id,
        ).execution_options(populate_existing=True))).scalar_one_or_none()
        if not receipt:
            raise NotFoundError("Transaction receipt not found")
        if receipt.retained_at:
            raise unavailable_record()
        return int(receipt.version)
    tx = _memory_transactions.get(receipt_id)
    if not tx or tx.get("shop_id") != shop_id:
        raise NotFoundError("Transaction receipt not found")
    if tx.get("retained_at"):
        raise unavailable_record()
    return int(tx.get("version", 1))


async def _load_revision(
    db: Optional[AsyncSession], order_id: str, revision_number: int,
) -> dict[str, Any]:
    if db is not None:
        row = (await db.execute(select(BuyerRevisionTable).where(
            BuyerRevisionTable.order_id == order_id,
            BuyerRevisionTable.revision_number == revision_number,
        ).execution_options(populate_existing=True))).scalar_one_or_none()
        if row is None:
            return {}
        return {
            "id": str(row.id),
            "payment_provider": row.payment_provider,
            "payment_trx_id": row.payment_trx_id,
            "payment_amount_minor": int(row.payment_amount_minor),
            "payment_sender_canonical": row.payment_sender_canonical,
            "claim_accepted_at": row.claim_accepted_at,
        }
    revisions = _memory_buyer_revisions.get(order_id, [])
    memory_row = next((item for item in revisions if item.get("revision_number") == revision_number), None)
    return dict(memory_row) if memory_row else {}


async def _matching_receipt(
    db: Optional[AsyncSession], shop_id: str, provider: Optional[str], trx_id: Optional[str],
) -> Optional[dict[str, str]]:
    if not provider or not trx_id:
        return None
    cleaned = clean_trx_id(trx_id)
    if db is not None:
        row = (await db.execute(select(ReceivedTransactionTable).where(
            ReceivedTransactionTable.shop_id == shop_id,
            ReceivedTransactionTable.retained_at.is_(None),
            ReceivedTransactionTable.provider == provider,
            ReceivedTransactionTable.trx_id == cleaned,
        ))).scalar_one_or_none()
        if row is None:
            return None
        return {"id": str(row.id), "provider": row.provider, "trx_id": row.trx_id}
    matching = next((tx for tx in _memory_transactions.values()
                     if tx.get("shop_id") == shop_id
                     and not tx.get("retained_at")
                     and tx.get("provider") == provider
                     and clean_trx_id(tx.get("trx_id", "")) == cleaned), None)
    if matching is None:
        return None
    return {"id": str(matching["id"]), "provider": str(matching["provider"]), "trx_id": str(matching["trx_id"])}


def _receipt_snapshot(receipt: ReceiptView) -> ReceiptSnapshot:
    return ReceiptSnapshot(
        payment_account_id=str(receipt.payment_account_id),
        amount_minor=int(receipt.amount_minor),
        sender_canonical=receipt.sender_number_canonical,
        occurred_at=receipt.occurred_at,
        has_conflict=bool(receipt.has_conflict),
        reconciliation_state=receipt.reconciliation_state,
        version=int(receipt.version),
        observations=tuple(ObservationSnapshot(
            id=str(item.id),
            payment_account_id=str(item.payment_account_id),
            amount_minor=int(item.amount_minor),
            sender_canonical=item.sender_number_canonical,
            occurred_at=item.occurred_at,
            conflict_state=item.conflict_state,
        ) for item in receipt.observations),
    )
