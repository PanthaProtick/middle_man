import datetime
import hashlib
import uuid
from collections.abc import Callable
from typing import Any

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import get_utc_now
from app.models.buyer import EvidenceUploadResponse
from app.models.entities import OrderEvidenceTable, OrderTable, ShopTable
from app.services.evidence_store import (
    StorageOutageError,
    read_evidence_file,
    save_evidence_file,
)
from app.services.image_service import (
    ImageValidationError,
    validate_and_sanitize_image,
)
from app.services.order_service import (
    _check_and_apply_expiry,
    _memory_orders,
    _memory_orders_by_digest,
)
from app.services.retention_access import require_retained_record
from app.services.seller_service import (
    NotFoundError,
    SellerDomainException,
)

MAX_EVIDENCE_PER_ORDER = 5

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
        digest = hashlib.sha256(portal_token.strip().encode("utf-8")).hexdigest()
        payload_hash = hashlib.sha256(raw_bytes).hexdigest()
        now = self.clock()

        if self.db is not None:
            shop_id = await self.db.scalar(select(OrderTable.shop_id).where(OrderTable.token_lookup_digest == digest))
            if shop_id is not None:
                await self.db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
            order = await self.db.scalar(
                select(OrderTable).where(OrderTable.token_lookup_digest == digest).with_for_update()
            )
            if order is None:
                raise NotFoundError("Order not found")
            require_retained_record(order)

            cached = await check_idempotency_record(
                self.db, idempotency_key, digest, "buyer_evidence_upload", payload_hash
            )
            if cached:
                return EvidenceUploadResponse(**cached[1]), cached[0]

            if _check_and_apply_expiry(order, now):
                await self.db.commit()

            if order.lifecycle == "expired":
                raise SellerDomainException(
                    status.HTTP_410_GONE, "EXPIRED_SUBMISSION", "Order link has expired. Cannot upload evidence."
                )
            if order.lifecycle != "awaiting_buyer":
                raise SellerDomainException(
                    status.HTTP_409_CONFLICT, "ORDER_ALREADY_SUBMITTED", "Order has already been submitted."
                )

            # Check excessive image upload limit (AC11)
            count = await self.db.scalar(
                select(func.count(OrderEvidenceTable.id)).where(
                    OrderEvidenceTable.order_id == order.id,
                    OrderEvidenceTable.status.in_(["staged", "attached"]),
                )
            ) or 0
            if count >= MAX_EVIDENCE_PER_ORDER:
                raise SellerDomainException(
                    422, "EXCESSIVE_IMAGES", "Order has reached the maximum screenshot attachment limit"
                )

            try:
                sanitized, meta = validate_and_sanitize_image(raw_bytes)
            except ImageValidationError as err:
                raise SellerDomainException(422, err.code, err.message) from err

            ext = "png" if meta.media_type == "image/png" else "jpg"
            evidence_id = str(uuid.uuid4())
            storage_key = f"{order.shop_id}/{order.id}/{evidence_id}.{ext}"

            try:
                save_evidence_file(storage_key, sanitized)
            except StorageOutageError as err:
                failed_record = OrderEvidenceTable(
                    id=evidence_id,
                    shop_id=order.shop_id,
                    order_id=order.id,
                    storage_key=storage_key,
                    media_type=meta.media_type,
                    byte_size=meta.byte_size,
                    width=meta.width,
                    height=meta.height,
                    sha256_digest=meta.sha256_digest,
                    status="failed",
                    collected_at=now,
                    delete_after=now + datetime.timedelta(days=30),
                    deleted_at=None,
                )
                self.db.add(failed_record)
                await self.db.commit()
                raise SellerDomainException(
                    status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", str(err)
                ) from err

            delete_after = now + datetime.timedelta(days=30)
            record = OrderEvidenceTable(
                id=evidence_id,
                shop_id=order.shop_id,
                order_id=order.id,
                storage_key=storage_key,
                media_type=meta.media_type,
                byte_size=meta.byte_size,
                width=meta.width,
                height=meta.height,
                sha256_digest=meta.sha256_digest,
                status="staged",
                collected_at=now,
                delete_after=delete_after,
                deleted_at=None,
            )
            self.db.add(record)

            res = EvidenceUploadResponse(
                evidence_id=evidence_id,
                media_type=meta.media_type,
                byte_size=meta.byte_size,
                width=meta.width,
                height=meta.height,
            )
            await save_idempotency_record(
                self.db,
                idempotency_key,
                digest,
                "buyer_evidence_upload",
                payload_hash,
                201,
                res.model_dump(mode="json"),
                commit=False,
            )
            await self.db.commit()
            return res, 201

        # Memory mode
        cached = await check_idempotency_record(
            None, idempotency_key, digest, "buyer_evidence_upload", payload_hash
        )
        if cached:
            return EvidenceUploadResponse(**cached[1]), cached[0]

        order_id = _memory_orders_by_digest.get(digest)
        if not order_id or order_id not in _memory_orders:
            raise NotFoundError("Order not found")
        order_raw = _memory_orders[order_id]

        _check_and_apply_expiry(order_raw, now)
        lifecycle = str(order_raw["lifecycle"])
        if lifecycle == "expired":
            raise SellerDomainException(
                status.HTTP_410_GONE, "EXPIRED_SUBMISSION", "Order link has expired. Cannot upload evidence."
            )
        if lifecycle != "awaiting_buyer":
            raise SellerDomainException(
                status.HTTP_409_CONFLICT, "ORDER_ALREADY_SUBMITTED", "Order has already been submitted."
            )

        active_count = sum(
            1 for item in _memory_order_evidence.values()
            if item.get("order_id") == order_id and item.get("status") in ("staged", "attached")
        )
        if active_count >= MAX_EVIDENCE_PER_ORDER:
            raise SellerDomainException(
                422, "EXCESSIVE_IMAGES", "Order has reached the maximum screenshot attachment limit"
            )

        try:
            sanitized, meta = validate_and_sanitize_image(raw_bytes)
        except ImageValidationError as err:
            raise SellerDomainException(422, err.code, err.message) from err

        ext = "png" if meta.media_type == "image/png" else "jpg"
        evidence_id = str(uuid.uuid4())
        shop_id = str(order_raw["shop_id"])
        storage_key = f"{shop_id}/{order_id}/{evidence_id}.{ext}"

        try:
            save_evidence_file(storage_key, sanitized)
        except StorageOutageError as err:
            _memory_order_evidence[evidence_id] = {
                "id": evidence_id,
                "shop_id": shop_id,
                "order_id": order_id,
                "storage_key": storage_key,
                "media_type": meta.media_type,
                "byte_size": meta.byte_size,
                "width": meta.width,
                "height": meta.height,
                "sha256_digest": meta.sha256_digest,
                "status": "failed",
                "collected_at": now,
                "delete_after": now + datetime.timedelta(days=30),
                "deleted_at": None,
            }
            raise SellerDomainException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", str(err)
            ) from err

        delete_after = now + datetime.timedelta(days=30)
        _memory_order_evidence[evidence_id] = {
            "id": evidence_id,
            "shop_id": shop_id,
            "order_id": order_id,
            "storage_key": storage_key,
            "media_type": meta.media_type,
            "byte_size": meta.byte_size,
            "width": meta.width,
            "height": meta.height,
            "sha256_digest": meta.sha256_digest,
            "status": "staged",
            "collected_at": now,
            "delete_after": delete_after,
            "deleted_at": None,
        }

        res = EvidenceUploadResponse(
            evidence_id=evidence_id,
            media_type=meta.media_type,
            byte_size=meta.byte_size,
            width=meta.width,
            height=meta.height,
        )
        await save_idempotency_record(
            None,
            idempotency_key,
            digest,
            "buyer_evidence_upload",
            payload_hash,
            201,
            res.model_dump(mode="json"),
        )
        return res, 201

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
            ev.status = "attached"
            return

        ev_item = _memory_order_evidence.get(evidence_id)
        if ev_item is None:
            raise SellerDomainException(422, "EVIDENCE_NOT_FOUND", "Referenced evidence not found")
        if ev_item.get("order_id") != order_id or ev_item.get("shop_id") != shop_id:
            raise SellerDomainException(
                422, "FOREIGN_EVIDENCE_REFERENCE", "Evidence references from another order or shop are invalid"
            )
        ev_item["status"] = "attached"

    async def get_seller_evidence(self, shop_id: str, evidence_id: str) -> tuple[bytes, str]:
        now = self.clock()
        if self.db is not None:
            record = await self.db.scalar(
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
                    status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", str(err)
                ) from err
            if data is None:
                raise SellerDomainException(
                    status.HTTP_410_GONE, "EVIDENCE_UNAVAILABLE", "Evidence content is unavailable"
                )
            return data, record.media_type

        item = _memory_order_evidence.get(evidence_id)
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
                status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", str(err)
            ) from err
        if data is None:
            raise SellerDomainException(
                status.HTTP_410_GONE, "EVIDENCE_UNAVAILABLE", "Evidence content is unavailable"
            )
        return data, str(item["media_type"])
