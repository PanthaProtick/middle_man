"""Manual decisions share automatic allocation writes and the shop-first lock."""
import json
import uuid

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import get_utc_now
from app.models.entities import AuditEventTable, OrderTable, ReceivedTransactionTable, ShopTable
from app.models.order import SellerOrder
from app.models.payment_decision import DecisionInput
from app.services.allocation import allocate_db, allocate_memory
from app.services.order_service import OrderService, _memory_orders
from app.services.payment_preview import payment_preview
from app.services.receipt_identity import receipt_identities
from app.services.reconciliation import compute_payment_digest
from app.services.reconciliation_store import _memory_audit_events
from app.services.seller_service import SellerDomainException, StaleVersionError, compute_payload_hash
from app.services.transaction_store import _memory_transactions


async def decide_order(
    db: AsyncSession | None, shop_id: str, actor: str, order_id: str,
    payload: DecisionInput, key: str
) -> SellerOrder:
    for attempt in range(3):
        try:
            if payload.action == 'confirm':
                return await _accept(db, shop_id, actor, order_id, payload, key)
            elif payload.action in ('cancel', 'reject'):
                return await _stop_order(db, shop_id, actor, order_id, payload, key)
            raise ValueError(f"Unknown action {payload.action}")
        except DBAPIError as error:
            if db is not None:
                await db.rollback()
            if getattr(error.orig, 'sqlstate', None) not in {'40001', '40P01'} or attempt == 2:
                raise
    raise RuntimeError('Decision retries exhausted')


accept_payment = decide_order


async def _accept(
    db: AsyncSession | None, shop_id: str, actor: str, order_id: str,
    payload: DecisionInput, key: str
) -> SellerOrder:
    if db is not None:
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
    await OrderService(db).get_order(shop_id, order_id)
    scope = f'seller:{actor}:{order_id}'
    hashed = compute_payload_hash(payload.model_dump())
    cached = await check_idempotency_record(db, key, scope, 'order_decision', hashed)
    if cached:
        return SellerOrder.model_validate(cached[1])
    assert payload.transaction_id is not None
    assert payload.accepted_amount_minor is not None
    preview = await payment_preview(db, shop_id, order_id, payload.transaction_id)
    if (preview.expected_version != payload.expected_version
            or preview.expected_transaction_version != payload.expected_transaction_version):
        raise StaleVersionError('Order or receipt changed. Refresh the preview before deciding.')
    if preview.blockers:
        raise SellerDomainException(409, preview.blockers[0], 'Payment cannot be accepted: ' + ', '.join(preview.blockers))
    if payload.accepted_amount_minor != preview.accepted_amount_minor:
        raise SellerDomainException(422, 'ACTUAL_AMOUNT_REQUIRED', 'Accept the entire recorded receipt amount; splitting is not supported.')
    receipt = preview.receipt
    identities = await receipt_identities(db, shop_id, receipt.id, receipt.provider, receipt.trx_id)
    digests = [(p, compute_payment_digest(shop_id, p, t)) for p, t in sorted(identities)]
    details = json.dumps({
        'transaction_id': receipt.id, 'accepted_amount_minor': receipt.amount_minor,
        'actual_cod_minor': preview.actual_cod_minor, 'exceptions': preview.exceptions,
        'reason': payload.reason, 'order_version': payload.expected_version,
        'transaction_version': payload.expected_transaction_version,
    })
    now = get_utc_now()
    if db is not None:
        order = (await db.execute(select(OrderTable).where(OrderTable.id == order_id).with_for_update())).scalar_one()
        tx = (await db.execute(select(ReceivedTransactionTable).where(
            ReceivedTransactionTable.id == receipt.id).with_for_update())).scalar_one()
        await allocate_db(db, order, tx, digests, now, basis='manual', actor=actor, reason=payload.reason, details=details)
    else:
        allocate_memory(
            _memory_orders[order_id], _memory_transactions[receipt.id],
            {(shop_id, p, digest) for p, digest in digests}, now,
            basis='manual', actor=actor, reason=payload.reason, details=details,
        )
    result = await OrderService(db).get_order(shop_id, order_id)
    await save_idempotency_record(
        db, key, scope, 'order_decision', hashed, 200,
        result.model_dump(mode='json'), commit=False,
    )
    if db is not None:
        await db.commit()
    return result


async def _stop_order(
    db: AsyncSession | None, shop_id: str, actor: str, order_id: str,
    payload: DecisionInput, key: str
) -> SellerOrder:
    if db is not None:
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
    order = await OrderService(db).get_order(shop_id, order_id)
    scope = f'seller:{actor}:{order_id}'
    hashed = compute_payload_hash(payload.model_dump())
    cached = await check_idempotency_record(db, key, scope, 'order_decision', hashed)
    if cached:
        return SellerOrder.model_validate(cached[1])

    if order.version != payload.expected_version:
        raise StaleVersionError('Order changed. Refresh before deciding.')

    if payload.action == 'cancel':
        if order.lifecycle in ('cancelled', 'rejected', 'expired'):
            raise SellerDomainException(409, 'LIFECYCLE_CONFLICT', f'Cannot cancel order in {order.lifecycle} status')
        new_lifecycle = 'cancelled'
        audit_action = 'order_cancelled'
    else:  # reject
        if order.lifecycle == 'confirmed':
            raise SellerDomainException(
                409, 'PAYMENT_ALREADY_CONFIRMED',
                'Confirmed orders cannot be rejected. Use cancellation to stop the order while preserving payment records.',
            )
        if order.lifecycle != 'pending':
            raise SellerDomainException(409, 'INVALID_LIFECYCLE', f'Cannot reject order in {order.lifecycle} status; only pending orders can be rejected')
        new_lifecycle = 'rejected'
        audit_action = 'order_rejected'

    now = get_utc_now()
    details = json.dumps({
        'action': payload.action,
        'reason': payload.reason,
        'order_version': payload.expected_version,
        'previous_lifecycle': order.lifecycle,
    })

    if db is not None:
        order_row = (await db.execute(select(OrderTable).where(OrderTable.id == order_id).with_for_update())).scalar_one()
        order_row.lifecycle = new_lifecycle
        order_row.version += 1
        order_row.completed_at = order_row.completed_at or now
        order_row.updated_at = now
        db.add(AuditEventTable(
            id=str(uuid.uuid4()), shop_id=shop_id, aggregate_type='order',
            aggregate_id=order_id, actor=actor, action=audit_action,
            details=details, created_at=now,
        ))
    else:
        raw = _memory_orders[order_id]
        raw['lifecycle'] = new_lifecycle
        raw['version'] = int(raw.get('version', 1)) + 1
        raw['completed_at'] = raw.get('completed_at') or now
        raw['updated_at'] = now
        _memory_audit_events.append({
            'id': str(uuid.uuid4()), 'shop_id': shop_id, 'aggregate_type': 'order',
            'aggregate_id': order_id, 'actor': actor, 'action': audit_action,
            'details': details, 'created_at': now,
        })

    result = await OrderService(db).get_order(shop_id, order_id)
    await save_idempotency_record(
        db, key, scope, 'order_decision', hashed, 200,
        result.model_dump(mode='json'), commit=False,
    )
    if db is not None:
        await db.commit()
    return result
