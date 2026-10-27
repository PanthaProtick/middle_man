"""Apply a resolution, its audit, and its replay receipt as one operation."""
import uuid
from datetime import datetime, timezone
from typing import Any, cast

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.courier_reconciliation import CourierReconciliationInput, CourierReconciliationTable
from app.models.courier_submission import CourierAttemptTable, CourierAttemptView
from app.models.entities import OrderTable
from app.services import pathao_provider
from app.services.courier_reconciliation_replay import ReconciliationReplay
from app.services.retention_access import require_retained_record
from app.services.seller_service import SellerDomainException, StaleVersionError

_memory_reconciliations: dict[str, list[dict[str, Any]]] = {}


def _conflict(code: str, message: str, status: int = 409) -> SellerDomainException:
    return SellerDomainException(status, code, message)


async def _apply(
    db: AsyncSession | None,
    actor: str,
    payload: CourierReconciliationInput,
    attempt: CourierAttemptView,
    raw: CourierAttemptTable | dict[str, Any],
    evidence: pathao_provider.CourierBookingEvidence | None,
    replay: ReconciliationReplay,
) -> None:
    # The caller holds the order lock. Recheck after provider I/O, since cleanup
    # may have completed while evidence was being verified.
    if db is not None:
        order = await db.get(OrderTable, attempt.order_id, populate_existing=True)
        if order is None:
            raise _conflict('RECORD_UNAVAILABLE', 'Order unavailable.', 410)
        require_retained_record(order)
    else:
        from app.services.order_service import _memory_orders
        require_retained_record(_memory_orders[attempt.order_id])
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
            await replay.save(db)
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
        # Save first: a receipt failure must leave the memory attempt untouched.
        # Neither save(None) nor the updates below yield to another request.
        await replay.save(None)
        raw = cast(dict[str, Any], raw)
        raw.update(
            status=status, consignment_id=consignment_id, error_code=error_code,
            error_message=error_message, resolution_version=version,
            resolution_action=payload.action, resolved_at=now, updated_at=now,
        )
        _memory_reconciliations.setdefault(attempt.id, []).append(record)
