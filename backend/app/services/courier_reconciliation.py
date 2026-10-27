"""Authenticated, versioned, idempotent resolution of unknown courier outcomes."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.courier_reconciliation import CourierReconciliationInput
from app.models.courier_review import CourierReview
from app.models.courier_submission import CourierAttemptTable, CourierAttemptView, to_attempt_view
from app.models.entities import OrderTable, ShopTable
from app.services import courier_review, pathao_connections, pathao_provider
from app.services.courier_reconciliation_replay import ReconciliationReplay
from app.services.courier_reconciliation_resolution import (
    _apply,
    _conflict,
)
from app.services.courier_reconciliation_resolution import (
    _memory_reconciliations as _memory_reconciliations,
)
from app.services.seller_service import (
    NotFoundError,
    SellerDomainException,
    StaleVersionError,
    compute_payload_hash,
)


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
    db: AsyncSession | None,
    shop: str,
    order_id: str,
    attempt: CourierAttemptView,
    payload: CourierReconciliationInput,
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
        credentials = await pathao_connections.submission_credentials(
            db, shop, attempt.environment, snapshot.connection_version,
        )
    except SellerDomainException:
        raise _conflict(
            'EVIDENCE_UNAVAILABLE',
            'The courier connection cannot verify this consignment now. Reload and try again.',
            422,
        ) from None
    try:
        evidence = await pathao_provider.lookup_booking(
            shop, attempt.environment, payload.consignment_id or '',
            payload.merchant_order_id or '', snapshot.store_id, credentials,
        )
    except pathao_provider.CourierEvidenceUnavailable:
        raise _conflict(
            'EVIDENCE_UNAVAILABLE',
            'The consignment could not be verified for this account and environment. Check Pathao again.',
            422,
        ) from None
    if (
        evidence.consignment_id.strip().upper() != (payload.consignment_id or '').strip().upper()
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


async def execute(
    db: AsyncSession | None,
    shop: str,
    actor: str,
    order_id: str,
    payload: CourierReconciliationInput,
    key: str,
) -> CourierReview:
    replay = ReconciliationReplay(
        key, f'seller:{actor}:{order_id}',
        compute_payload_hash(payload.model_dump(mode='json')), payload.attempt_id,
    )
    cached = await replay.read(db)
    if isinstance(cached, CourierReview):
        return await courier_review.read(db, shop, order_id)
    if cached is not None:
        return await replay.respond(db, shop, order_id)

    attempt = await _read_attempt(db, shop, order_id, payload.attempt_id)
    # A concurrent request may have committed between the first read and this one.
    cached = await replay.read(db)
    if db is not None:
        await db.commit()
    if cached is not None:
        if isinstance(cached, CourierReview):
            return await courier_review.read(db, shop, order_id)
        return await replay.respond(db, shop, order_id)
    _assert_reconcilable(attempt, payload.expected_version)

    evidence = None
    if payload.action == 'attach_existing':
        evidence = await _verify_existing(db, shop, order_id, attempt, payload)

    locked, raw = await _lock_attempt(db, shop, order_id, payload.attempt_id)
    cached = await replay.read(db)
    if cached is not None:
        if db is not None:
            await db.commit()
        if isinstance(cached, CourierReview):
            return await courier_review.read(db, shop, order_id)
        return await replay.respond(db, shop, order_id)
    _assert_reconcilable(locked, payload.expected_version)
    if evidence is not None:
        await _assert_consignment_unused(db, evidence.consignment_id)
    await _apply(db, actor, payload, locked, raw, evidence, replay)
    return await replay.respond(db, shop, order_id)
