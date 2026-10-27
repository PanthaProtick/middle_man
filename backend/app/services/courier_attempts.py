"""Durable submission attempts, concurrency serialization, and outcome classification."""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.models.courier_review import CourierReview
from app.models.courier_submission import (
    AttemptStatus,
    CourierAttemptTable,
    CourierAttemptView,
    to_attempt_view,
)
from app.services import courier_review, pathao_provider
from app.services.courier_outcomes import (
    sanitize_definitive_error,
    sanitize_unexpected_error,
    validate_booking_result,
)
from app.services.courier_reservation import reserve_attempt
from app.services.seller_service import (
    SellerDomainException,
    compute_payload_hash,
)

_memory_attempts: dict[str, list[dict[str, Any]]] = {}
_active_attempt_ids: set[str] = set()


async def get_attempts(db: AsyncSession | None, order_id: str) -> list[CourierAttemptView]:
    if db is not None:
        stmt = (
            select(CourierAttemptTable)
            .where(CourierAttemptTable.order_id == order_id)
            .order_by(CourierAttemptTable.attempt_number.asc())
            .execution_options(populate_existing=True)
        )
        res = await db.scalars(stmt)
        return [to_attempt_view(row) for row in res.all()]
    records = _memory_attempts.get(order_id, [])
    return [to_attempt_view(rec) for rec in records]


async def record_outcome(
    db: AsyncSession | None,
    attempt: CourierAttemptView,
    outcome: AttemptStatus,
    *,
    consignment_id: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> CourierAttemptView:
    now = datetime.now(timezone.utc)
    if db is not None:
        row = await db.get(CourierAttemptTable, attempt.id, with_for_update=True, populate_existing=True)
        if row is not None:
            row.status = outcome
            row.consignment_id = consignment_id
            row.error_code = error_code
            row.error_message = error_message
            row.updated_at = now
            await db.commit()
            return to_attempt_view(row)

    records = _memory_attempts.get(attempt.order_id, [])
    for rec in records:
        if rec['id'] == attempt.id:
            rec['status'] = outcome
            rec['consignment_id'] = consignment_id
            rec['error_code'] = error_code
            rec['error_message'] = error_message
            rec['updated_at'] = now
            return to_attempt_view(rec)

    attempt.status = outcome
    attempt.consignment_id = consignment_id
    attempt.error_code = error_code
    attempt.error_message = error_message
    attempt.updated_at = now
    return attempt


async def get_latest_attempt(db: AsyncSession | None, order_id: str) -> CourierAttemptView | None:
    attempts = await get_attempts(db, order_id)
    if not attempts:
        return None
    latest = attempts[-1]
    if latest.status == 'submitting' and latest.id not in _active_attempt_ids:
        latest = await record_outcome(
            db, latest, 'unknown',
            error_code='INTERRUPTED_IN_FLIGHT',
            error_message='Submission was interrupted in flight before a confirmed outcome was received.',
        )
    return latest


async def assert_order_allows_edits(
    db: AsyncSession | None,
    order_id: str,
    action: str = 'Review',
) -> None:
    latest = await get_latest_attempt(db, order_id)
    if latest is not None and latest.status in ('submitting', 'success', 'unknown'):
        raise SellerDomainException(
            409,
            'COURIER_ATTEMPT_PROTECTED',
            f'{action} cannot be changed while a courier attempt is booked, in progress, or pending reconciliation.',
        )


async def execute_submission(
    db: AsyncSession | None,
    shop: str,
    actor: str,
    order_id: str,
    expected_token: str,
    key: str,
) -> CourierReview:
    scope = f'seller:{actor}:{order_id}'
    hashed = compute_payload_hash({'expected_token': expected_token})
    cached = await check_idempotency_record(db, key, scope, 'courier_submission', hashed)
    if cached:
        return await courier_review.read(db, shop, order_id)

    attempt, snapshot = await reserve_attempt(db, shop, order_id, expected_token)

    try:
        # Phase 3: Provider I/O strictly outside the transaction.
        result = await pathao_provider.submit_booking(shop, attempt.environment, snapshot)
        is_valid, validation_err = validate_booking_result(result, attempt, snapshot)
        if not is_valid:
            await record_outcome(
                db, attempt, 'unknown',
                error_code='MALFORMED_SUCCESS',
                error_message=validation_err or 'Courier returned ambiguous or malformed confirmation.',
            )
            raise SellerDomainException(
                504, 'COURIER_OUTCOME_UNKNOWN',
                'Courier returned ambiguous or malformed confirmation. Attempt is protected as unknown outcome.',
            )
        try:
            await record_outcome(db, attempt, 'success', consignment_id=result.consignment_id)
        except Exception:
            try:
                await record_outcome(
                    db, attempt, 'unknown',
                    error_code='PERSISTENCE_FAILURE',
                    error_message='Provider accepted booking, but local outcome persistence failed.',
                )
            except Exception:
                pass
            raise SellerDomainException(
                504, 'COURIER_OUTCOME_UNKNOWN',
                'Provider accepted booking, but local save failed. Attempt is protected as unknown outcome.',
            ) from None
    except pathao_provider.CourierDefinitiveFailure:
        safe_msg = sanitize_definitive_error()
        await record_outcome(db, attempt, 'failed', error_code='COURIER_REJECTED', error_message=safe_msg)
        raise SellerDomainException(422, 'COURIER_REJECTED', f"Pathao rejected booking: {safe_msg}") from None
    except SellerDomainException:
        raise
    except Exception as err:
        safe_code, safe_msg = sanitize_unexpected_error(err)
        await record_outcome(db, attempt, 'unknown', error_code=safe_code, error_message=safe_msg)
        raise SellerDomainException(
            504, 'COURIER_OUTCOME_UNKNOWN',
            'Courier submission outcome unknown. Resubmission blocked until reconciled.',
        ) from None
    finally:
        _active_attempt_ids.discard(attempt.id)

    review = await courier_review.read(db, shop, order_id)
    await save_idempotency_record(
        db, key, scope, 'courier_submission', hashed, 200, review.model_dump(mode='json'), commit=True,
    )
    return review
