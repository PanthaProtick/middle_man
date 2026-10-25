import datetime
from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import get_utc_now
from app.models.buyer import EvidenceUploadResponse
from app.models.entities import OrderEvidenceTable
from app.services.evidence_retrieval import fetch_seller_evidence
from app.services.evidence_staging import stage_buyer_evidence_impl
from app.services.seller_service import SellerDomainException

_memory_order_evidence: dict[str, dict[str, Any]] = {}


def reset_memory_evidence() -> None:
    _memory_order_evidence.clear()


class EvidenceService:
    def __init__(
        self,
        db: AsyncSession | None = None,
        clock: Callable[[], datetime.datetime] = get_utc_now,
    ) -> None:
        self.db = db
        self.clock = clock

    async def stage_buyer_evidence(
        self,
        portal_token: str,
        raw_bytes: bytes,
        idempotency_key: str,
    ) -> tuple[EvidenceUploadResponse, int]:
        return await stage_buyer_evidence_impl(
            self.db,
            self.clock(),
            _memory_order_evidence,
            portal_token,
            raw_bytes,
            idempotency_key,
        )

    async def attach_order_evidence(self, order_id: str, shop_id: str, evidence_id: str) -> None:
        if self.db is not None:
            ev = await self.db.scalar(
                select(OrderEvidenceTable)
                .where(OrderEvidenceTable.id == evidence_id)
                .with_for_update()
            )
            if ev is None:
                raise SellerDomainException(422, "EVIDENCE_NOT_FOUND", "Referenced evidence not found")
            if ev.order_id != order_id or ev.shop_id != shop_id:
                raise SellerDomainException(
                    422, "FOREIGN_EVIDENCE_REFERENCE", "Evidence references from another order or shop are invalid"
                )
            if ev.status not in ("staged", "attached"):
                raise SellerDomainException(
                    422, "UNCOMMITTED_EVIDENCE", "Evidence upload was not successful and cannot be attached"
                )
            ev.status = "attached"
            return

        ev_item = _memory_order_evidence.get(evidence_id)
        if ev_item is None:
            raise SellerDomainException(422, "EVIDENCE_NOT_FOUND", "Referenced evidence not found")
        if ev_item.get("order_id") != order_id or ev_item.get("shop_id") != shop_id:
            raise SellerDomainException(
                422, "FOREIGN_EVIDENCE_REFERENCE", "Evidence references from another order or shop are invalid"
            )
        if ev_item.get("status") not in ("staged", "attached"):
            raise SellerDomainException(
                422, "UNCOMMITTED_EVIDENCE", "Evidence upload was not successful and cannot be attached"
            )
        ev_item["status"] = "attached"

    async def get_seller_evidence(self, shop_id: str, evidence_id: str) -> tuple[bytes, str]:
        return await fetch_seller_evidence(
            self.db,
            self.clock,
            _memory_order_evidence,
            shop_id,
            evidence_id,
        )
