"""Seller corrections share the allocator transaction and preserve claim timing."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import get_utc_now
from app.models.buyer import Address, BuyerSubmission, PaymentClaim
from app.models.correction import BuyerCorrection, BuyerHistory, BuyerRevisionView
from app.models.entities import BuyerRevisionTable, OrderTable, ReceivedTransactionTable, ShopTable
from app.models.order import SellerOrder
from app.services.buyer_revision import buyer_revision
from app.services.buyer_service import _memory_buyer_revisions
from app.services.order_service import OrderService, _memory_orders
from app.services.reconciliation import compute_payment_digest, reconcile_order, reconcile_receipt
from app.services.reconciliation_db import reconcile_order_db
from app.services.seller_service import SellerDomainException, StaleVersionError, compute_payload_hash
from app.services.transaction_store import _memory_transactions


def revision_view(raw: dict[str, Any]) -> BuyerRevisionView:
    return BuyerRevisionView(
        id=raw['id'], revision_number=raw['revision_number'], buyer_name=raw['buyer_name'],
        contact_number=raw['contact_number_raw'],
        address=Address(raw_text=raw['address_raw'], **{key: raw['address_' + key] for key in
                     ('district', 'thana', 'area', 'street_line', 'landmark')}),
        payment_claim=PaymentClaim(provider=raw['payment_provider'], trx_id=raw['payment_trx_id'],
            sender_number=raw['payment_sender_raw'], amount_minor=raw['payment_amount_minor'],
            claimed_at=raw['payment_claimed_at'], evidence_id=raw['payment_evidence_id']),
        actor=raw['actor'], reason=raw['reason'], created_at=raw['created_at'],
        claim_accepted_at=raw['claim_accepted_at'])


async def history(db: AsyncSession | None, shop_id: str, order_id: str,
                  cursor: str | None = None, limit: int = 25) -> BuyerHistory:
    # Authorize even when there are no revisions.
    await OrderService(db).get_order(shop_id, order_id)
    if db is not None:
        after = 0
        if cursor:
            after = await db.scalar(select(BuyerRevisionTable.revision_number).where(
                BuyerRevisionTable.order_id == order_id, BuyerRevisionTable.id == cursor)) or 0
        rows = (await db.scalars(select(BuyerRevisionTable).where(
            BuyerRevisionTable.order_id == order_id, BuyerRevisionTable.revision_number > after
        ).order_by(BuyerRevisionTable.revision_number).limit(limit + 1))).all()
        items = [revision_view({c.name: getattr(row, c.name) for c in BuyerRevisionTable.__table__.columns}) for row in rows]
        page = items[:limit]
        return BuyerHistory(items=page, next_cursor=page[-1].id if len(items) > limit else None)
    else:
        items = [revision_view(raw) for raw in _memory_buyer_revisions.get(order_id, [])]
    start = next((i + 1 for i, item in enumerate(items) if item.id == cursor), 0)
    page = items[start:start + limit]
    return BuyerHistory(items=page, next_cursor=page[-1].id if start + limit < len(items) else None)


async def correct(db: AsyncSession | None, shop_id: str, actor: str, order_id: str,
                  payload: BuyerCorrection, key: str) -> SellerOrder:
    for attempt in range(3):
        try:
            return await _correct(db, shop_id, actor, order_id, payload, key)
        except DBAPIError as error:
            if db is not None:
                await db.rollback()
            if getattr(error.orig, 'sqlstate', None) not in {'40001', '40P01'} or attempt == 2:
                raise
    raise RuntimeError('Correction retries exhausted')


async def _correct(db: AsyncSession | None, shop_id: str, actor: str, order_id: str,
                   payload: BuyerCorrection, key: str) -> SellerOrder:
    if db is not None:
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
    order = await OrderService(db).get_order(shop_id, order_id)
    scope = f'seller:{actor}:{order_id}'
    hashed = compute_payload_hash(payload.model_dump(mode='json'))
    cached = await check_idempotency_record(db, key, scope, 'correct_buyer', hashed)
    if cached:
        return SellerOrder.model_validate(cached[1])
    if order.version != payload.expected_version:
        raise StaleVersionError('Order changed. Refresh before correcting.')
    if order.lifecycle not in {'pending', 'confirmed'}:
        raise SellerDomainException(409, 'INVALID_LIFECYCLE', f'Cannot correct order in {order.lifecycle} status.')
    if order.lifecycle == 'confirmed' and 'payment_claim' in payload.model_fields_set:
        raise SellerDomainException(409, 'PAYMENT_FIELDS_LOCKED', 'Payment fields are locked after confirmation.')
    if db is not None:
        active = await db.scalar(select(BuyerRevisionTable).where(
            BuyerRevisionTable.order_id == order_id, BuyerRevisionTable.revision_number == order.buyer_revision))
        assert active is not None
        prior = revision_view({c.name: getattr(active, c.name) for c in BuyerRevisionTable.__table__.columns})
    else:
        prior = revision_view(_memory_buyer_revisions[order_id][-1])
    fields = ('buyer_name', 'contact_number', 'address', 'payment_claim')
    values = prior.model_dump(include=set(fields))
    values.update(payload.model_dump(include=set(fields), exclude_unset=True))
    submission = BuyerSubmission.model_validate(values)
    now = get_utc_now()
    changed_claim = submission.payment_claim != prior.payment_claim
    raw = buyer_revision(submission, order_id, now)
    raw.update(revision_number=prior.revision_number + 1, actor=actor, source='seller', reason=payload.reason,
               claim_accepted_at=now if changed_claim else prior.claim_accepted_at)
    identities = (
        {(prior.payment_claim.provider, prior.payment_claim.trx_id),
         (submission.payment_claim.provider, submission.payment_claim.trx_id)}
        if changed_claim
        else set()
    )
    receipt_ids = []
    if db is not None:
        record = await db.get(OrderTable, order_id)
        assert record is not None
        db.add(BuyerRevisionTable(**raw))
        record.buyer_revision = raw['revision_number']
        record.version += 1
        record.updated_at = now
        for provider, trx_id in sorted(identities):
            receipt = await db.scalar(select(ReceivedTransactionTable).where(
                ReceivedTransactionTable.shop_id == shop_id, ReceivedTransactionTable.provider == provider,
                ReceivedTransactionTable.trx_id == trx_id).with_for_update())
            if receipt:
                receipt.version += 1
                receipt.updated_at = now
                receipt_ids.append(receipt.id)
        await db.flush()
    else:
        _memory_buyer_revisions[order_id].append(raw)
        _memory_orders[order_id].update(buyer_revision=raw['revision_number'], version=order.version + 1, updated_at=now)
        for memory_receipt in _memory_transactions.values():
            if memory_receipt['shop_id'] == shop_id and (memory_receipt['provider'], memory_receipt['trx_id']) in identities:
                memory_receipt.update(version=memory_receipt['version'] + 1, updated_at=now)
                receipt_ids.append(memory_receipt['id'])
    # Both identities matter: moving a competing claim may release an older receipt.
    if db is not None:
        # Retry the whole correction after rollback, never just its allocator tail.
        await reconcile_order_db(db, order_id, now, compute_payment_digest, max_retries=1)
    else:
        await reconcile_order(None, order_id)
    for receipt_id in receipt_ids:
        await reconcile_receipt(db, receipt_id)
    result = await OrderService(db).get_order(shop_id, order_id)
    await save_idempotency_record(db, key, scope, 'correct_buyer', hashed, 200,
                                  result.model_dump(mode='json'), commit=False)
    if db is not None:
        await db.commit()
    return result
