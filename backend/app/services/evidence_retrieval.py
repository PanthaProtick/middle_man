import datetime
from collections.abc import Callable
from typing import Any

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import OrderEvidenceTable
from app.services.evidence_store import StorageOutageError, read_evidence_file
from app.services.seller_service import NotFoundError, SellerDomainException


async def fetch_seller_evidence(
    db: AsyncSession | None,
    clock: Callable[[], datetime.datetime],
    memory_store: dict[str, dict[str, Any]],
    shop_id: str,
    evidence_id: str,
) -> tuple[bytes, str]:
    now = clock()
    if db is not None:
        record = await db.scalar(
            select(OrderEvidenceTable).where(
                OrderEvidenceTable.id == evidence_id,
                OrderEvidenceTable.shop_id == shop_id,
            )
        )
        if record is None or record.status not in ("attached", "deleted"):
            raise NotFoundError("Evidence not found")
        if record.deleted_at is not None or record.status == "deleted":
            raise SellerDomainException(
                status.HTTP_410_GONE, "EVIDENCE_UNAVAILABLE", "Evidence is unavailable (retained copy was deleted)"
            )
        if now >= record.delete_after:
            raise SellerDomainException(
                status.HTTP_410_GONE, "EVIDENCE_EXPIRED", "Evidence retention deadline has passed"
            )
        try:
            data = read_evidence_file(record.storage_key)
        except StorageOutageError as err:
            raise SellerDomainException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Private storage service is unavailable"
            ) from err
        if data is None:
            raise SellerDomainException(
                status.HTTP_410_GONE, "EVIDENCE_UNAVAILABLE", "Evidence content is unavailable"
            )
        return data, record.media_type

    item = memory_store.get(evidence_id)
    if not item or item.get("shop_id") != shop_id or item.get("status") not in ("attached", "deleted"):
        raise NotFoundError("Evidence not found")
    if item.get("deleted_at") is not None or item.get("status") == "deleted":
        raise SellerDomainException(
            status.HTTP_410_GONE, "EVIDENCE_UNAVAILABLE", "Evidence is unavailable (retained copy was deleted)"
        )
    if now >= item["delete_after"]:
        raise SellerDomainException(
            status.HTTP_410_GONE, "EVIDENCE_EXPIRED", "Evidence retention deadline has passed"
        )
    try:
        data = read_evidence_file(item["storage_key"])
    except StorageOutageError as err:
        raise SellerDomainException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Private storage service is unavailable"
        ) from err
    if data is None:
        raise SellerDomainException(
            status.HTTP_410_GONE, "EVIDENCE_UNAVAILABLE", "Evidence content is unavailable"
        )
    return data, str(item["media_type"])
