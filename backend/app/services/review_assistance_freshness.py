"""Deterministic freshness signatures for review assistance revalidation."""
import datetime
from typing import Any, Optional

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AllocationTable, UsedPaymentMarkerTable
from app.models.resolution import ReceiptComparison
from app.services.receipt_identity import receipt_identities
from app.services.reconciliation import compute_payment_digest
from app.services.reconciliation_store import (
    _memory_allocations,
    _memory_used_payment_markers,
)
from app.services.review_assistance_context import ReceiptSnapshot


def iso(value: Optional[datetime.datetime]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def receipt_signature(receipt: Optional[ReceiptSnapshot]) -> tuple[Any, ...]:
    if receipt is None:
        return ()
    return (
        receipt.payment_account_id, receipt.amount_minor, receipt.sender_canonical,
        iso(receipt.occurred_at), receipt.has_conflict, receipt.reconciliation_state,
        receipt.version,
        tuple(sorted((item.id, item.payment_account_id, item.amount_minor, item.sender_canonical,
                      iso(item.occurred_at), item.conflict_state) for item in receipt.observations)),
    )


def comparison_signature(comparison: ReceiptComparison) -> tuple[Any, ...]:
    latest = comparison.history[-1] if comparison.history else None
    return (
        len(comparison.history),
        latest.selected_observation_id if latest else None,
        latest.selected_order_id if latest else None,
        tuple(sorted(latest.rejected_revision_ids)) if latest else (),
        iso(latest.created_at) if latest else None,
        len(comparison.corrections),
    )


async def receipt_allocation_ids(
    db: Optional[AsyncSession], shop_id: str, receipt_id: str,
) -> list[str]:
    if db is not None:
        ids = (await db.scalars(select(AllocationTable.id).where(
            AllocationTable.shop_id == shop_id,
            AllocationTable.transaction_id == receipt_id,
        ))).all()
        return sorted(str(item) for item in ids)
    return sorted(str(item["id"]) for item in _memory_allocations.values()
                  if item["shop_id"] == shop_id and item["transaction_id"] == receipt_id)


async def used_marker_present(
    db: Optional[AsyncSession], shop_id: str, receipt_id: str, provider: str, trx_id: str,
) -> bool:
    identities = await receipt_identities(db, shop_id, receipt_id, provider, trx_id)
    digests = [(item_provider, compute_payment_digest(shop_id, item_provider, item_trx))
               for item_provider, item_trx in sorted(identities)]
    if db is not None:
        marker = await db.scalar(select(UsedPaymentMarkerTable.id).where(
            UsedPaymentMarkerTable.shop_id == shop_id,
            tuple_(UsedPaymentMarkerTable.provider, UsedPaymentMarkerTable.transaction_digest).in_(digests),
        ).limit(1))
        return marker is not None
    return any((shop_id, item_provider, digest) in _memory_used_payment_markers
               for item_provider, digest in digests)
