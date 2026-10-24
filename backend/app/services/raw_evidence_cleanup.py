import datetime
import uuid
from typing import Any, Literal, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.address_entities import AddressExtractionTable
from app.models.cleanup import (
    CleanupFailureItem,
    EvidenceCleanupTable,
    RetentionCleanupResponse,
    RetentionStatusResponse,
)
from app.models.entities import OrderEvidenceTable
from app.models.payment_entities import PaymentExtractionTable
from app.models.sms_entities import SmsEvidenceTable
from app.services.address_assistance import _memory as _memory_address
from app.services.evidence_service import _memory_order_evidence
from app.services.evidence_store import StorageOutageError, delete_evidence_file
from app.services.payment_extraction import _memory as _memory_payment
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
        # 1. Order Evidence (images)
        ev_query = select(OrderEvidenceTable).where(
            OrderEvidenceTable.delete_after <= now,
            OrderEvidenceTable.deleted_at.is_(None),
            OrderEvidenceTable.status != "deleted",
        )
        if shop_id:
            ev_query = ev_query.where(OrderEvidenceTable.shop_id == shop_id)
        ev_records = (await db.scalars(ev_query)).all()

        for ev in ev_records:
            try:
                delete_evidence_file(ev.storage_key)
                ev.status = "deleted"
                ev.deleted_at = now
                purged_count += 1
            except (StorageOutageError, OSError):
                failed_count += 1
                failures.append(
                    CleanupFailureItem(
                        evidence_type="screenshot",
                        evidence_id=ev.id,
                        order_id=ev.order_id,
                        delete_after=ev.delete_after,
                        error="Storage service unavailable: failed to remove file",
                    )
                )

        # 2. SMS Evidence
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

        # 3. Address AI extractions
        addr_query = select(AddressExtractionTable).where(
            AddressExtractionTable.delete_after <= now,
            or_(
                AddressExtractionTable.raw_request.is_not(None),
                AddressExtractionTable.raw_response.is_not(None),
            ),
        )
        if shop_id:
            addr_query = addr_query.where(AddressExtractionTable.shop_id == shop_id)
        addr_records = (await db.scalars(addr_query)).all()
        for addr in addr_records:
            addr.raw_request = None
            addr.raw_response = None
            purged_count += 1

        # 4. Payment AI extractions
        pay_query = select(PaymentExtractionTable).where(
            PaymentExtractionTable.delete_after <= now,
            PaymentExtractionTable.raw_response.is_not(None),
        )
        if shop_id:
            pay_query = pay_query.where(PaymentExtractionTable.shop_id == shop_id)
        pay_records = (await db.scalars(pay_query)).all()
        for pay in pay_records:
            pay.raw_response = None
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
        rem_ev_q = select(func.count(OrderEvidenceTable.id)).where(
            OrderEvidenceTable.delete_after <= now,
            OrderEvidenceTable.deleted_at.is_(None),
            OrderEvidenceTable.status != "deleted",
        )
        rem_sms_q = select(func.count(SmsEvidenceTable.id)).where(
            SmsEvidenceTable.delete_after <= now,
            SmsEvidenceTable.raw_text.is_not(None),
        )
        rem_addr_q = select(func.count(AddressExtractionTable.id)).where(
            AddressExtractionTable.delete_after <= now,
            or_(
                AddressExtractionTable.raw_request.is_not(None),
                AddressExtractionTable.raw_response.is_not(None),
            ),
        )
        rem_pay_q = select(func.count(PaymentExtractionTable.id)).where(
            PaymentExtractionTable.delete_after <= now,
            PaymentExtractionTable.raw_response.is_not(None),
        )
        if shop_id:
            rem_ev_q = rem_ev_q.where(OrderEvidenceTable.shop_id == shop_id)
            rem_sms_q = rem_sms_q.where(SmsEvidenceTable.shop_id == shop_id)
            rem_addr_q = rem_addr_q.where(AddressExtractionTable.shop_id == shop_id)
            rem_pay_q = rem_pay_q.where(PaymentExtractionTable.shop_id == shop_id)

        overdue_rem += (await db.scalar(rem_ev_q)) or 0
        overdue_rem += (await db.scalar(rem_sms_q)) or 0
        overdue_rem += (await db.scalar(rem_addr_q)) or 0
        overdue_rem += (await db.scalar(rem_pay_q)) or 0

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
    # 1. Images
    for ev_id, mem_ev in list(_memory_order_evidence.items()):
        if shop_id and mem_ev.get("shop_id") != shop_id:
            continue
        if mem_ev.get("delete_after") and mem_ev["delete_after"] <= now:
            if mem_ev.get("deleted_at") is None and mem_ev.get("status") != "deleted":
                try:
                    delete_evidence_file(mem_ev["storage_key"])
                    mem_ev["status"] = "deleted"
                    mem_ev["deleted_at"] = now
                    purged_count += 1
                except (StorageOutageError, OSError):
                    failed_count += 1
                    failures.append(
                        CleanupFailureItem(
                            evidence_type="screenshot",
                            evidence_id=ev_id,
                            order_id=mem_ev.get("order_id"),
                            delete_after=mem_ev["delete_after"],
                            error="Storage service unavailable: failed to remove file",
                        )
                    )

    # 2. SMS
    for k, sms in list(_memory_sms.items()):
        if shop_id and sms.shop_id != shop_id:
            continue
        if sms.delete_after <= now and sms.raw_text is not None:
            sms.raw_text = None
            purged_count += 1

    # 3. Address
    for k, addr in list(_memory_address.items()):
        if shop_id and addr.shop_id != shop_id:
            continue
        if addr.delete_after <= now and (addr.raw_request is not None or addr.raw_response is not None):
            addr.raw_request = None
            addr.raw_response = None
            purged_count += 1

    # 4. Payment
    for k, pay in list(_memory_payment.items()):
        if shop_id and pay.shop_id != shop_id:
            continue
        if pay.delete_after <= now and pay.raw_response is not None:
            pay.raw_response = None
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

    overdue_rem = (
        sum(
            1 for mem_ev in _memory_order_evidence.values()
            if (not shop_id or mem_ev.get("shop_id") == shop_id)
            and mem_ev.get("delete_after") and mem_ev["delete_after"] <= now
            and mem_ev.get("deleted_at") is None and mem_ev.get("status") != "deleted"
        )
        + sum(
            1 for sms in _memory_sms.values()
            if (not shop_id or sms.shop_id == shop_id)
            and sms.delete_after <= now and sms.raw_text is not None
        )
        + sum(
            1 for addr in _memory_address.values()
            if (not shop_id or addr.shop_id == shop_id)
            and addr.delete_after <= now
            and (addr.raw_request is not None or addr.raw_response is not None)
        )
        + sum(
            1 for pay in _memory_payment.values()
            if (not shop_id or pay.shop_id == shop_id)
            and pay.delete_after <= now and pay.raw_response is not None
        )
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
