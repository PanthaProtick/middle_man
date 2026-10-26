"""Authenticated, versioned, idempotent resolution of unknown courier outcomes."""
import uuid
from datetime import datetime, timezone
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.models.courier_reconciliation import CourierReconciliationInput, CourierReconciliationTable
from app.models.courier_review import CourierReview
from app.models.courier_submission import CourierAttemptTable, CourierAttemptView, to_attempt_view
from app.models.entities import OrderTable, ShopTable
from app.services import courier_review, pathao_provider
from app.services.seller_service import (
    NotFoundError,
    SellerDomainException,
    StaleVersionError,
    compute_payload_hash,
)

_memory_reconciliations: dict[str, list[dict[str, Any]]] = {}


def _conflict(code: str, message: str, status: int = 409) -> SellerDomainException:
    return SellerDomainException(status, code, message)


async def _read_attempt(db: AsyncSession | None, shop: str, order_id: str, attempt_id: str) -> CourierAttemptView:
    if db is not None:
        row = await db.get(CourierAttemptTable, attempt_id, populate_existing=True)
        if row is not None and row.shop_id == shop and row.order_id == order_id:
            view = to_attempt_view(row)
            await db.commit()
            return view
        await db.commit()
        raise NotFoundError('Courier attempt not found')
    return _memory_attempt(shop, order_id, attempt_id)[0]


def _memory_attempt(shop: str, order_id: str, attempt_id: str) -> tuple[CourierAttemptView, dict[str, Any]]:
    from app.services.courier_attempts import _memory_attempts
    for record in _memory_attempts.get(order_id, []):
        if record['id'] == attempt_id and record.get('shop_id') == shop:
            return to_attempt_view(record), record
    raise NotFoundError('Courier attempt not found')


def _assert_reconcilable(attempt: CourierAttemptView, expected_version: int) -> None:
    if attempt.status != 'unknown':
        raise _conflict(
            'ATTEMPT_NOT_RECONCILABLE',
            'Only an unknown submission outcome can be reconciled.',
        )
    if attempt.resolution_version != expected_version:
        raise StaleVersionError('Courier attempt changed. Reload before reconciling.')


async def _assert_consignment_unused(
    db: AsyncSession | None, consignment_id: str,
) -> None:
    in_use: object | None
    if db is not None:
        stmt = select(CourierAttemptTable.id).where(
            CourierAttemptTable.consignment_id == consignment_id,
        ).limit(1)
        in_use = await db.scalar(stmt)
    else:
        from app.services.courier_attempts import _memory_attempts
        in_use = next((
            record for records in _memory_attempts.values()
            for record in records if record.get('consignment_id') == consignment_id
        ), None)
    if in_use is not None:
        raise _conflict(
            'CONSIGNMENT_ALREADY_ASSOCIATED',
            'This consignment is already associated with another order.',
        )


async def _verify_existing(
    shop: str, order_id: str, attempt: CourierAttemptView, payload: CourierReconciliationInput,
) -> pathao_provider.CourierBookingEvidence:
    if payload.environment != attempt.environment:
        raise _conflict(
            'EVIDENCE_MISMATCH', 'Consignment evidence does not match this attempt environment.', 422,
        )
    if payload.merchant_order_id != order_id:
        raise _conflict(
            'EVIDENCE_MISMATCH', 'The merchant order reference does not match this order.', 422,
        )
    snapshot = attempt.booking_snapshot
    if snapshot is None:
        raise _conflict(
            'EVIDENCE_UNAVAILABLE',
            'The reviewed booking snapshot is unavailable, so this consignment cannot be attached.',
            422,
        )
    try:
        evidence = await pathao_provider.lookup_booking(
            shop, attempt.environment, payload.consignment_id or '',
            payload.merchant_order_id or '', snapshot.store_id,
        )
    except pathao_provider.CourierEvidenceUnavailable:
        raise _conflict(
            'EVIDENCE_UNAVAILABLE',
            'The consignment could not be verified for this account and environment. Check Pathao again.',
            422,
        ) from None
    if (
        evidence.consignment_id != (payload.consignment_id or '').strip().upper()
        or evidence.merchant_order_id != order_id
        or evidence.environment != attempt.environment
        or evidence.store_id != snapshot.store_id
        or evidence.is_simulated != (attempt.environment == 'offline')
    ):
        raise _conflict('EVIDENCE_MISMATCH', 'Consignment evidence does not match this attempt.', 422)
    return evidence


async def _lock_attempt(
    db: AsyncSession | None, shop: str, order_id: str, attempt_id: str,
) -> tuple[CourierAttemptView, CourierAttemptTable | dict[str, Any]]:
    if db is not None:
        await db.scalar(select(ShopTable).where(ShopTable.id == shop).with_for_update())
        order = await db.scalar(
            select(OrderTable).where(OrderTable.id == order_id, OrderTable.shop_id == shop)
            .with_for_update().execution_options(populate_existing=True)
        )
        row = await db.get(CourierAttemptTable, attempt_id, with_for_update=True, populate_existing=True)
        if order is None or row is None or row.shop_id != shop or row.order_id != order_id:
            raise NotFoundError('Courier attempt not found')
        return to_attempt_view(row), row
    return _memory_attempt(shop, order_id, attempt_id)


async def _apply(
    db: AsyncSession | None,
    actor: str,
    payload: CourierReconciliationInput,
    attempt: CourierAttemptView,
    raw: CourierAttemptTable | dict[str, Any],
    evidence: pathao_provider.CourierBookingEvidence | None,
) -> None:
    now = datetime.now(timezone.utc)
    version = attempt.resolution_version + 1
    if payload.action == 'attach_existing':
        status = 'success'
        consignment_id = evidence.consignment_id if evidence else None
        merchant_order_id = evidence.merchant_order_id if evidence else None
        error_code = None
        error_message = None
        evidence_data: dict[str, Any] | None = {
            'consignment_id': consignment_id,
            'merchant_order_id': merchant_order_id,
            'environment': attempt.environment,
            'store_id': evidence.store_id if evidence else None,
            'simulated': evidence.is_simulated if evidence else False,
            'prior_error_code': attempt.error_code,
        }
    else:
        status = 'failed'
        consignment_id = None
        merchant_order_id = None
        error_code = 'CONFIRMED_NONCREATION'
        error_message = 'Seller confirmed the courier created no booking for this attempt.'
        evidence_data = {'environment': attempt.environment, 'prior_error_code': attempt.error_code}
    record = {
        'id': str(uuid.uuid4()), 'attempt_id': attempt.id, 'actor': actor,
        'action': payload.action, 'resolution_version': version,
        'resulting_status': status, 'environment': attempt.environment,
        'consignment_id': consignment_id, 'merchant_order_id': merchant_order_id,
        'evidence': evidence_data, 'created_at': now,
    }
    if db is not None:
        raw = cast(CourierAttemptTable, raw)
        raw.status = status
        raw.consignment_id = consignment_id
        raw.error_code = error_code
        raw.error_message = error_message
        raw.resolution_version = version
        raw.resolution_action = payload.action
        raw.resolved_at = now
        raw.updated_at = now
        db.add(CourierReconciliationTable(
            **record, order_id=raw.order_id, shop_id=raw.shop_id,
        ))
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            constraint = getattr(exc.orig, 'constraint_name', '') or str(exc.orig)
            if 'consignment' in constraint or 'booked_order' in constraint:
                raise _conflict(
                    'CONSIGNMENT_ALREADY_ASSOCIATED',
                    'This consignment is already associated with another order.',
                ) from None
            raise StaleVersionError('Courier attempt changed. Reload before reconciling.') from None
    else:
        raw = cast(dict[str, Any], raw)
        raw.update(
            status=status, consignment_id=consignment_id, error_code=error_code,
            error_message=error_message, resolution_version=version,
            resolution_action=payload.action, resolved_at=now, updated_at=now,
        )
        _memory_reconciliations.setdefault(attempt.id, []).append(record)


async def execute(
    db: AsyncSession | None,
    shop: str,
    actor: str,
    order_id: str,
    payload: CourierReconciliationInput,
    key: str,
) -> CourierReview:
    scope = f'seller:{actor}:{order_id}'
    hashed = compute_payload_hash(payload.model_dump(mode='json'))
    cached = await check_idempotency_record(db, key, scope, 'courier_reconciliation', hashed)
    if cached:
        return CourierReview.model_validate(cached[1])

    attempt = await _read_attempt(db, shop, order_id, payload.attempt_id)
    _assert_reconcilable(attempt, payload.expected_version)

    evidence = None
    if payload.action == 'attach_existing':
        evidence = await _verify_existing(shop, order_id, attempt, payload)
        await _assert_consignment_unused(db, evidence.consignment_id)

    locked, raw = await _lock_attempt(db, shop, order_id, payload.attempt_id)
    _assert_reconcilable(locked, payload.expected_version)
    if evidence is not None:
        await _assert_consignment_unused(db, evidence.consignment_id)
    await _apply(db, actor, payload, locked, raw, evidence)

    review = await courier_review.read(db, shop, order_id)
    await save_idempotency_record(
        db, key, scope, 'courier_reconciliation', hashed, 200, review.model_dump(mode='json'), commit=True,
    )
    return review
