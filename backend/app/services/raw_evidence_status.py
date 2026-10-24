import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.address_entities import AddressExtractionTable
from app.models.cleanup import (
    CleanupFailureItem,
    EvidenceCleanupTable,
    RetentionStatusResponse,
)
from app.models.entities import OrderEvidenceTable
from app.models.payment_entities import PaymentExtractionTable
from app.models.sms_entities import SmsEvidenceTable
from app.services.address_assistance import _memory as _memory_address
from app.services.evidence_service import _memory_order_evidence
from app.services.payment_extraction import _memory as _memory_payment
from app.services.sms_import import _memory_evidence as _memory_sms


async def get_retention_status(
    db: Optional[AsyncSession],
    now: datetime.datetime,
    shop_id: str,
    memory_cleanups: Optional[list[dict[str, Any]]] = None,
) -> RetentionStatusResponse:
    counts: dict[str, int] = {
        "screenshots_active": 0,
        "screenshots_deleted": 0,
        "sms_active": 0,
        "sms_purged": 0,
        "ai_extractions_active": 0,
        "ai_extractions_purged": 0,
    }
    overdue_items: list[CleanupFailureItem] = []
    failed_count = 0
    last_cleanup_at: Optional[datetime.datetime] = None

    if db is not None:
        ev_rows = (await db.scalars(
            select(OrderEvidenceTable).where(OrderEvidenceTable.shop_id == shop_id)
        )).all()
        for ev in ev_rows:
            if ev.deleted_at is not None or ev.status == "deleted":
                counts["screenshots_deleted"] += 1
            else:
                counts["screenshots_active"] += 1
                if ev.delete_after <= now:
                    overdue_items.append(
                        CleanupFailureItem(
                            evidence_type="screenshot",
                            evidence_id=ev.id,
                            order_id=ev.order_id,
                            delete_after=ev.delete_after,
                            error="Cleanup overdue: retained beyond 30 days",
                        )
                    )

        sms_rows = (await db.scalars(
            select(SmsEvidenceTable).where(SmsEvidenceTable.shop_id == shop_id)
        )).all()
        for sms in sms_rows:
            if sms.raw_text is None:
                counts["sms_purged"] += 1
            else:
                counts["sms_active"] += 1
                if sms.delete_after <= now:
                    overdue_items.append(
                        CleanupFailureItem(
                            evidence_type="sms",
                            evidence_id=sms.id,
                            delete_after=sms.delete_after,
                            error="Cleanup overdue: raw SMS retained beyond 30 days",
                        )
                    )

        addr_rows = (await db.scalars(
            select(AddressExtractionTable).where(AddressExtractionTable.shop_id == shop_id)
        )).all()
        for addr in addr_rows:
            if addr.raw_request is None and addr.raw_response is None:
                counts["ai_extractions_purged"] += 1
            else:
                counts["ai_extractions_active"] += 1
                if addr.delete_after <= now:
                    overdue_items.append(
                        CleanupFailureItem(
                            evidence_type="address_ai",
                            evidence_id=addr.id,
                            order_id=addr.order_id,
                            delete_after=addr.delete_after,
                            error="Cleanup overdue: AI address text retained beyond 30 days",
                        )
                    )

        pay_rows = (await db.scalars(
            select(PaymentExtractionTable).where(PaymentExtractionTable.shop_id == shop_id)
        )).all()
        for pay in pay_rows:
            if pay.raw_response is None:
                counts["ai_extractions_purged"] += 1
            else:
                counts["ai_extractions_active"] += 1
                if pay.delete_after <= now:
                    overdue_items.append(
                        CleanupFailureItem(
                            evidence_type="payment_ai",
                            evidence_id=pay.id,
                            order_id=pay.order_id,
                            delete_after=pay.delete_after,
                            error="Cleanup overdue: AI payment text retained beyond 30 days",
                        )
                    )

        last_run = await db.scalar(
            select(EvidenceCleanupTable)
            .where(EvidenceCleanupTable.shop_id == shop_id)
            .order_by(EvidenceCleanupTable.ran_at.desc())
            .limit(1)
        )
        if last_run is not None:
            last_cleanup_at = last_run.ran_at
            failed_count = last_run.items_failed

        return RetentionStatusResponse(
            shop_id=shop_id,
            checked_at=now,
            counts=counts,
            overdue_count=len(overdue_items),
            failed_count=failed_count,
            last_cleanup_at=last_cleanup_at,
            overdue_items=overdue_items,
        )

    # Memory mode
    for ev_id, mem_ev in _memory_order_evidence.items():
        if mem_ev.get("shop_id") == shop_id:
            if mem_ev.get("deleted_at") is not None or mem_ev.get("status") == "deleted":
                counts["screenshots_deleted"] += 1
            else:
                counts["screenshots_active"] += 1
                if mem_ev.get("delete_after") and mem_ev["delete_after"] <= now:
                    overdue_items.append(
                        CleanupFailureItem(
                            evidence_type="screenshot",
                            evidence_id=ev_id,
                            order_id=mem_ev.get("order_id"),
                            delete_after=mem_ev["delete_after"],
                            error="Cleanup overdue: retained beyond 30 days",
                        )
                    )

    for k, sms in _memory_sms.items():
        if sms.shop_id == shop_id:
            if sms.raw_text is None:
                counts["sms_purged"] += 1
            else:
                counts["sms_active"] += 1
                if sms.delete_after <= now:
                    overdue_items.append(
                        CleanupFailureItem(
                            evidence_type="sms",
                            evidence_id=sms.id,
                            delete_after=sms.delete_after,
                            error="Cleanup overdue: raw SMS retained beyond 30 days",
                        )
                    )

    for k, addr in _memory_address.items():
        if addr.shop_id == shop_id:
            if addr.raw_request is None and addr.raw_response is None:
                counts["ai_extractions_purged"] += 1
            else:
                counts["ai_extractions_active"] += 1
                if addr.delete_after <= now:
                    overdue_items.append(
                        CleanupFailureItem(
                            evidence_type="address_ai",
                            evidence_id=addr.id,
                            order_id=addr.order_id,
                            delete_after=addr.delete_after,
                            error="Cleanup overdue: AI address text retained beyond 30 days",
                        )
                    )

    for k, pay in _memory_payment.items():
        if pay.shop_id == shop_id:
            if pay.raw_response is None:
                counts["ai_extractions_purged"] += 1
            else:
                counts["ai_extractions_active"] += 1
                if pay.delete_after <= now:
                    overdue_items.append(
                        CleanupFailureItem(
                            evidence_type="payment_ai",
                            evidence_id=pay.id,
                            order_id=pay.order_id,
                            delete_after=pay.delete_after,
                            error="Cleanup overdue: AI payment text retained beyond 30 days",
                        )
                    )

    if memory_cleanups:
        relevant_cleanups = [
            c for c in memory_cleanups if c.get("shop_id") == shop_id
        ]
        if relevant_cleanups:
            last = relevant_cleanups[-1]
            last_cleanup_at = last.get("ran_at")
            failed_count = last.get("items_failed", 0)

    return RetentionStatusResponse(
        shop_id=shop_id,
        checked_at=now,
        counts=counts,
        overdue_count=len(overdue_items),
        failed_count=failed_count,
        last_cleanup_at=last_cleanup_at,
        overdue_items=overdue_items,
    )
