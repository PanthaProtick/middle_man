import datetime
import hashlib
import uuid
from typing import Any

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.models.buyer import EvidenceUploadResponse
from app.models.entities import OrderEvidenceTable, OrderTable, ShopTable
from app.services.evidence_store import (
    StorageOutageError,
    delete_evidence_file,
    record_orphan_evidence,
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
from app.services.public_order_access import require_public_order_access
from app.services.seller_service import NotFoundError, SellerDomainException

MAX_EVIDENCE_PER_ORDER = 5


async def stage_buyer_evidence_impl(
    db: AsyncSession | None,
    now: datetime.datetime,
    memory_store: dict[str, dict[str, Any]],
    portal_token: str,
    raw_bytes: bytes,
    idempotency_key: str,
) -> tuple[EvidenceUploadResponse, int]:
    digest = hashlib.sha256(portal_token.strip().encode("utf-8")).hexdigest()
    payload_hash = hashlib.sha256(raw_bytes).hexdigest()

    try:
        sanitized, meta = validate_and_sanitize_image(raw_bytes)
    except ImageValidationError as err:
        raise SellerDomainException(422, err.code, err.message) from err

    ext = "png" if meta.media_type == "image/png" else "jpg"
    evidence_id = str(uuid.uuid4())

    if db is not None:
        shop_id = await db.scalar(select(OrderTable.shop_id).where(OrderTable.token_lookup_digest == digest))
        if shop_id is not None:
            await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
        order = await db.scalar(
            select(OrderTable).where(OrderTable.token_lookup_digest == digest).with_for_update().execution_options(populate_existing=True)
        )
        if order is None:
            raise NotFoundError("Order not found")
        require_public_order_access(order)

        cached = await check_idempotency_record(
            db, idempotency_key, digest, "buyer_evidence_upload", payload_hash
        )
        if cached:
            return EvidenceUploadResponse(**cached[1]), cached[0]

        if _check_and_apply_expiry(order, now):
            await db.commit()

        if order.lifecycle == "expired":
            raise SellerDomainException(
                status.HTTP_410_GONE, "EXPIRED_SUBMISSION", "Order link has expired. Cannot upload evidence."
            )
        if order.lifecycle != "awaiting_buyer":
            raise SellerDomainException(
                status.HTTP_409_CONFLICT, "ORDER_ALREADY_SUBMITTED", "Order has already been submitted."
            )

        # Check excessive image upload limit (AC11)
        count = await db.scalar(
            select(func.count(OrderEvidenceTable.id)).where(
                OrderEvidenceTable.order_id == order.id,
                OrderEvidenceTable.status.in_(["staged", "attached"]),
            )
        ) or 0
        if count >= MAX_EVIDENCE_PER_ORDER:
            raise SellerDomainException(
                422, "EXCESSIVE_IMAGES", "Order has reached the maximum screenshot attachment limit"
            )

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
            db.add(failed_record)
            await db.commit()
            raise SellerDomainException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Private storage service is unavailable"
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
        db.add(record)

        res = EvidenceUploadResponse(
            evidence_id=evidence_id,
            media_type=meta.media_type,
            byte_size=meta.byte_size,
            width=meta.width,
            height=meta.height,
        )
        await save_idempotency_record(
            db,
            idempotency_key,
            digest,
            "buyer_evidence_upload",
            payload_hash,
            201,
            res.model_dump(mode="json"),
            commit=False,
        )
        try:
            await db.commit()
        except Exception as err:
            await db.rollback()
            try:
                delete_evidence_file(storage_key)
            except StorageOutageError:
                record_orphan_evidence(storage_key)
            raise SellerDomainException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Private storage service is unavailable"
            ) from err
        return res, 201

    # Memory mode
    order_id = _memory_orders_by_digest.get(digest)
    if not order_id or order_id not in _memory_orders:
        raise NotFoundError("Order not found")
    order_raw = _memory_orders[order_id]
    require_public_order_access(order_raw)
    cached = await check_idempotency_record(
        None, idempotency_key, digest, "buyer_evidence_upload", payload_hash
    )
    if cached:
        return EvidenceUploadResponse(**cached[1]), cached[0]

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
        1 for item in memory_store.values()
        if item.get("order_id") == order_id and item.get("status") in ("staged", "attached")
    )
    if active_count >= MAX_EVIDENCE_PER_ORDER:
        raise SellerDomainException(
            422, "EXCESSIVE_IMAGES", "Order has reached the maximum screenshot attachment limit"
        )

    shop_id = str(order_raw["shop_id"])
    storage_key = f"{shop_id}/{order_id}/{evidence_id}.{ext}"

    try:
        save_evidence_file(storage_key, sanitized)
    except StorageOutageError as err:
        memory_store[evidence_id] = {
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
            status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Private storage service is unavailable"
        ) from err

    try:
        delete_after = now + datetime.timedelta(days=30)
        memory_store[evidence_id] = {
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
    except Exception as err:
        try:
            delete_evidence_file(storage_key)
        except StorageOutageError:
            record_orphan_evidence(storage_key)
        raise SellerDomainException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Private storage service is unavailable"
        ) from err
