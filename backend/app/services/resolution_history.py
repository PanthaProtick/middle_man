"""Revision-specific decisions live in the existing durable, shop-scoped audit log."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AuditEventTable
from app.models.receipt_correction import ReceiptCorrectionEvent
from app.models.resolution import ResolutionDecision
from app.services.reconciliation_store import _memory_audit_events


async def resolution_history(db: AsyncSession | None, shop_id: str, receipt_id: str) -> list[ResolutionDecision]:
    if db is not None:
        details = (await db.execute(select(AuditEventTable.details).where(
            AuditEventTable.shop_id == shop_id, AuditEventTable.aggregate_type == "transaction",
            AuditEventTable.aggregate_id == receipt_id, AuditEventTable.action == "evidence_resolved",
        ).order_by(AuditEventTable.created_at, AuditEventTable.id))).scalars().all()
    else:
        details = [e["details"] for e in _memory_audit_events if e["shop_id"] == shop_id
                   and e["aggregate_id"] == receipt_id and e["action"] == "evidence_resolved"]
    return [ResolutionDecision.model_validate_json(d) for d in details if d]


async def rejected_revisions(db: AsyncSession | None, shop_id: str, receipt_id: str) -> set[str]:
    history = await resolution_history(db, shop_id, receipt_id)
    return set(history[-1].rejected_revision_ids) if history else set()


async def correction_history(db: AsyncSession | None, shop_id: str, receipt_id: str) -> list[ReceiptCorrectionEvent]:
    if db is not None:
        details = (await db.scalars(select(AuditEventTable.details).where(
            AuditEventTable.shop_id == shop_id, AuditEventTable.aggregate_type == "transaction",
            AuditEventTable.aggregate_id == receipt_id, AuditEventTable.action == "receipt_corrected",
        ).order_by(AuditEventTable.created_at, AuditEventTable.id))).all()
    else:
        details = [e["details"] for e in _memory_audit_events if e["shop_id"] == shop_id
                   and e["aggregate_id"] == receipt_id and e["action"] == "receipt_corrected"]
    return [ReceiptCorrectionEvent.model_validate_json(d) for d in details if d]
