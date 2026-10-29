import datetime
import uuid
from typing import Any, Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cleanup import (
    CleanupFailureItem,
    EvidenceCleanupTable,
    RetentionCleanupResponse,
    RetentionStatusResponse,
)
from app.models.sms_entities import SmsEvidenceTable
from app.services.raw_evidence_status import get_retention_status as _get_retention_status
from app.services.sms_import import _memory_evidence as _memory_sms

_memory_cleanups: list[dict[str, Any]] = []


def reset_cleanup_memory() -> None:
    _memory_cleanups.clear()


async def purge_raw_evidence(
    db: Optional[AsyncSession],
    now: datetime.datetime,
    shop_id: Optional[str] = None,
) -> RetentionCleanupResponse:
    purged_count = 0
    failed_count = 0
    failures: list[CleanupFailureItem] = []
    status_val: Literal["clean", "partial_failure", "failed"] = "clean"

    if db is not None:
        sms_query = select(SmsEvidenceTable).where(
            SmsEvidenceTable.delete_after <= now,
            SmsEvidenceTable.raw_text.is_not(None),
        )
        if shop_id:
            sms_query = sms_query.where(SmsEvidenceTable.shop_id == shop_id)
        sms_records = (await db.scalars(sms_query)).all()
        for sms in sms_records:
            sms.raw_text = None
            purged_count += 1

        status_val = "clean" if failed_count == 0 else "partial_failure"
        record = EvidenceCleanupTable(
            id=str(uuid.uuid4()),
            shop_id=shop_id,
            ran_at=now,
            items_purged=purged_count,
            items_failed=failed_count,
            status=status_val,
            error_message="; ".join(f.error for f in failures) if failures else None,
        )
        db.add(record)
        await db.commit()

        overdue_rem = 0
        rem_sms_q = select(func.count(SmsEvidenceTable.id)).where(
            SmsEvidenceTable.delete_after <= now,
            SmsEvidenceTable.raw_text.is_not(None),
        )
        if shop_id:
            rem_sms_q = rem_sms_q.where(SmsEvidenceTable.shop_id == shop_id)

        overdue_rem += (await db.scalar(rem_sms_q)) or 0

        return RetentionCleanupResponse(
            shop_id=shop_id or "all",
            ran_at=now,
            items_purged=purged_count,
            items_failed=failed_count,
            overdue_remaining=overdue_rem,
            status=status_val,
            failures=failures,
        )

    # In-memory mode
    for k, sms in list(_memory_sms.items()):
        if shop_id and sms.shop_id != shop_id:
            continue
        if sms.delete_after <= now and sms.raw_text is not None:
            sms.raw_text = None
            purged_count += 1

    status_val = "clean" if failed_count == 0 else "partial_failure"
    _memory_cleanups.append(
        {
            "id": str(uuid.uuid4()),
            "shop_id": shop_id,
            "ran_at": now,
            "items_purged": purged_count,
            "items_failed": failed_count,
            "status": status_val,
            "error_message": "; ".join(f.error for f in failures) if failures else None,
        }
    )

    overdue_rem = sum(
        1 for sms in _memory_sms.values()
        if (not shop_id or sms.shop_id == shop_id)
        and sms.delete_after <= now and sms.raw_text is not None
    )

    return RetentionCleanupResponse(
        shop_id=shop_id or "all",
        ran_at=now,
        items_purged=purged_count,
        items_failed=failed_count,
        overdue_remaining=overdue_rem,
        status=status_val,
        failures=failures,
    )


async def get_retention_status(
    db: Optional[AsyncSession],
    now: datetime.datetime,
    shop_id: str,
) -> RetentionStatusResponse:
    return await _get_retention_status(db, now, shop_id, _memory_cleanups)
