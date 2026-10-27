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
from app.models.sms_entities import SmsEvidenceTable
from app.services.address_assistance import _memory as _memory_address
from app.services.sms_import import _memory_evidence as _memory_sms


async def get_retention_status(
    db: Optional[AsyncSession],
    now: datetime.datetime,
    shop_id: str,
    memory_cleanups: Optional[list[dict[str, Any]]] = None,
) -> RetentionStatusResponse:
    counts: dict[str, int] = {
        "sms_active": 0,
        "sms_purged": 0,
        "ai_extractions_active": 0,
        "ai_extractions_purged": 0,
    }
    overdue_items: list[CleanupFailureItem] = []
    failed_count = 0
    last_cleanup_at: Optional[datetime.datetime] = None

    if db is not None:
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
