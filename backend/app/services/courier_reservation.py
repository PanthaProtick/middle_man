"""Atomic courier reservation and validation under held database locks."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.courier_submission import (
    CourierAttemptTable,
    CourierAttemptView,
    CourierBookingSnapshot,
    to_attempt_view,
)
from app.models.entities import ShopTable
from app.models.pathao import PathaoConnectionTable
from app.services import courier_review
from app.services import pathao_connections as connections
from app.services.courier_drafts import _load
from app.services.courier_review import fingerprint, marker_value
from app.services.seller_service import SellerDomainException, StaleVersionError


async def reserve_attempt(
    db: AsyncSession | None,
    shop: str,
    order_id: str,
    expected_token: str,
) -> tuple[CourierAttemptView, CourierBookingSnapshot]:
    """Reserves a courier attempt under locks held continuously through commit."""
    from app.services.courier_attempts import _active_attempt_ids, _memory_attempts

    # Phase 1: Unlocked review read and initial blocker/environment check.
    review = await courier_review.read(db, shop, order_id)
    if "ORDER_NOT_CONFIRMED" in review.draft.blockers:
        raise SellerDomainException(409, "INVALID_LIFECYCLE", "Only confirmed orders can be submitted.")
    if review.token != expected_token:
        raise StaleVersionError("Review details changed. Reload and review current details.")
    if not review.reviewed:
        raise SellerDomainException(409, "REVIEW_REQUIRED", "Review must be approved before submission.")
    if review.blockers:
        raise SellerDomainException(409, "COURIER_NOT_READY", "Resolve all readiness blockers before submission.")
    if review.choices.environment == "production":
        raise SellerDomainException(422, "REAL_BOOKING_DISABLED", "Production booking remains disabled.")

    # Phase 2: Hold locks through final validation and reservation commit.
    if db is not None:
        await db.scalar(select(ShopTable).where(ShopTable.id == shop).with_for_update())
        version = await db.scalar(
            select(PathaoConnectionTable.version)
            .where(
                PathaoConnectionTable.shop_id == shop,
                PathaoConnectionTable.environment == review.choices.environment,
            )
            .order_by(PathaoConnectionTable.version.desc())
            .limit(1)
        )
    else:
        version = (await connections.latest(db, shop, review.choices.environment)).version

    record = await _load(db, shop, order_id, lock_draft=True)
    if record.lifecycle != "confirmed":
        raise SellerDomainException(409, "INVALID_LIFECYCLE", "Only confirmed orders can be submitted.")
    if marker_value(record, "reviewed_token") != expected_token:
        raise SellerDomainException(409, "REVIEW_REQUIRED", "Review must be approved before submission.")
    if expected_token != review.token or fingerprint(record, review.choices, version or 0) != expected_token:
        raise StaleVersionError("Review details changed. Reload and review current details.")

    if db is not None:
        stmt = (
            select(CourierAttemptTable)
            .where(CourierAttemptTable.order_id == order_id)
            .with_for_update()
            .order_by(CourierAttemptTable.attempt_number.asc())
            .execution_options(populate_existing=True)
        )
        existing = (await db.scalars(stmt)).all()
        if any(a.status == "success" for a in existing):
            raise SellerDomainException(409, "ALREADY_BOOKED", "Order already has an accepted courier booking.")
        if any(a.status in ("unknown", "submitting") for a in existing):
            raise SellerDomainException(
                409,
                "COURIER_OUTCOME_UNKNOWN",
                "Submission outcome unknown. Resubmission blocked until reconciled.",
            )
        next_num = len(existing) + 1
    else:
        mem_existing = _memory_attempts.get(order_id, [])
        if any(a["status"] == "success" for a in mem_existing):
            raise SellerDomainException(409, "ALREADY_BOOKED", "Order already has an accepted courier booking.")
        if any(a["status"] in ("unknown", "submitting") for a in mem_existing):
            raise SellerDomainException(
                409,
                "COURIER_OUTCOME_UNKNOWN",
                "Submission outcome unknown. Resubmission blocked until reconciled.",
            )
        next_num = len(mem_existing) + 1

    attempt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    correlation_id = f"{order_id}-{next_num}"

    snapshot = CourierBookingSnapshot(
        order_id=order_id,
        recipient_name=record.recipient_name,
        recipient_phone=record.contact_number,
        recipient_address=record.address,
        city_id=review.choices.location.city_id or 0,
        zone_id=review.choices.location.zone_id or 0,
        area_id=review.choices.location.area_id,
        store_id=review.choices.store_id or 0,
        delivery_type=review.choices.delivery_type or 48,
        item_weight_grams=record.parcel_weight_grams or 0,
        item_quantity=record.parcel_quantity or 0,
        amount_to_collect_bdt=record.remaining_cod_minor // 100,
        remaining_cod_minor=record.remaining_cod_minor,
        connection_version=version or 0,
    )

    if db is not None:
        table_row = CourierAttemptTable(
            id=attempt_id,
            order_id=order_id,
            shop_id=shop,
            attempt_number=next_num,
            environment=review.choices.environment,
            status="submitting",
            reviewed_token=expected_token,
            correlation_id=correlation_id,
            consignment_id=None,
            booking_snapshot=snapshot.model_dump(mode="json"),
            error_code=None,
            error_message=None,
            created_at=now,
            updated_at=now,
        )
        db.add(table_row)
        await db.commit()
        view = to_attempt_view(table_row)
    else:
        mem_row = {
            "id": attempt_id,
            "order_id": order_id,
            "shop_id": shop,
            "attempt_number": next_num,
            "environment": review.choices.environment,
            "status": "submitting",
            "reviewed_token": expected_token,
            "correlation_id": correlation_id,
            "consignment_id": None,
            "booking_snapshot": snapshot.model_dump(mode="json"),
            "error_code": None,
            "error_message": None,
            "created_at": now,
            "updated_at": now,
        }
        _memory_attempts.setdefault(order_id, []).append(mem_row)
        view = to_attempt_view(mem_row)

    _active_attempt_ids.add(view.id)
    return view, snapshot
