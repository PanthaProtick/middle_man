import datetime
import uuid
from typing import Callable, List, Optional

from sqlalchemy import delete, select, tuple_
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.buyer import clean_trx_id
from app.models.entities import (
    AllocationTable,
    AuditEventTable,
    BuyerRevisionTable,
    OrderReviewReasonTable,
    OrderTable,
    ReceivedTransactionTable,
    ShopTable,
    UsedPaymentMarkerTable,
)
from app.services.receipt_identity import receipt_identities
from app.services.reconciliation_rules import (
    COMPETING_CLAIMS,
    PAYMENT_USED,
    AllocationRecord,
    evaluate_candidate_match,
)


async def get_order_allocation_db(db: AsyncSession, order_id: str) -> Optional[AllocationRecord]:
    stmt = select(AllocationTable).where(AllocationTable.order_id == order_id)
    res = await db.execute(stmt)
    alloc = res.scalar_one_or_none()
    if not alloc:
        return None
    return AllocationRecord(
        id=str(alloc.id),
        shop_id=str(alloc.shop_id),
        order_id=str(alloc.order_id),
        transaction_id=str(alloc.transaction_id),
        accepted_amount_minor=int(alloc.accepted_amount_minor),
        basis=str(alloc.basis),
        actor=str(alloc.actor),
        reason=alloc.reason,
        created_at=alloc.created_at,
    )


async def get_order_review_reasons_db(db: AsyncSession, order_id: str) -> List[str]:
    stmt = select(OrderReviewReasonTable.reason).where(
        OrderReviewReasonTable.order_id == order_id
    ).order_by(OrderReviewReasonTable.created_at.asc())
    res = await db.execute(stmt)
    return [str(r) for r in res.scalars().all()]


async def append_order_review_reasons_db(
    db: AsyncSession, order_id: str, new_reasons: List[str], now: datetime.datetime
) -> None:
    await db.flush()
    existing = await get_order_review_reasons_db(db, order_id)
    combined = sorted(list(set(existing + new_reasons)))
    await db.execute(delete(OrderReviewReasonTable).where(OrderReviewReasonTable.order_id == order_id))
    for r in combined:
        db.add(OrderReviewReasonTable(id=str(uuid.uuid4()), order_id=order_id, reason=r, created_at=now))
    await db.flush()


async def clear_order_review_reasons_db(db: AsyncSession, order_id: str) -> None:
    await db.execute(delete(OrderReviewReasonTable).where(OrderReviewReasonTable.order_id == order_id))


async def reconcile_order_db(
    db: AsyncSession,
    order_id: str,
    now: datetime.datetime,
    digest_calculator: Callable[[str, str, str], str],
    max_retries: int = 3,
) -> bool:
    for attempt in range(max_retries):
        try:
            shop_id = await db.scalar(select(OrderTable.shop_id).where(OrderTable.id == order_id))
            if shop_id is not None:
                await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
            return await _reconcile_order_db_attempt(db, order_id, now, digest_calculator)
        except DBAPIError:
            await db.rollback()
            if attempt == max_retries - 1:
                raise
    return False


async def _reconcile_order_db_attempt(
    db: AsyncSession,
    order_id: str,
    now: datetime.datetime,
    digest_calculator: Callable[[str, str, str], str],
) -> bool:
    order_stmt = select(OrderTable).where(OrderTable.id == order_id).with_for_update()
    order = (await db.execute(order_stmt)).scalar_one_or_none()
    if not order or order.lifecycle != "pending":
        return False

    rev_stmt = select(BuyerRevisionTable).where(
        BuyerRevisionTable.order_id == order_id,
        BuyerRevisionTable.revision_number == order.buyer_revision,
    )
    active_rev = (await db.execute(rev_stmt)).scalar_one_or_none()
    if not active_rev:
        return False

    # Review reasons describe this check of the active revision, not old claims.
    await clear_order_review_reasons_db(db, order_id)

    provider = active_rev.payment_provider
    trx_id = clean_trx_id(active_rev.payment_trx_id)
    sender_canonical = active_rev.payment_sender_canonical
    claimed_amount = int(active_rev.payment_amount_minor)
    claim_sub_time = active_rev.claim_accepted_at

    # Check competing active claims on matching active revisions
    comp_stmt = select(OrderTable.id).join(
        BuyerRevisionTable,
        (BuyerRevisionTable.order_id == OrderTable.id)
        & (BuyerRevisionTable.revision_number == OrderTable.buyer_revision),
    ).where(
        OrderTable.shop_id == order.shop_id,
        OrderTable.lifecycle == "pending",
        BuyerRevisionTable.payment_provider == provider,
        BuyerRevisionTable.payment_trx_id == trx_id,
    ).distinct()
    competing_order_ids = [str(r) for r in (await db.execute(comp_stmt)).scalars().all()]

    tx_stmt = select(ReceivedTransactionTable).where(
        ReceivedTransactionTable.shop_id == order.shop_id,
        ReceivedTransactionTable.provider == provider,
        ReceivedTransactionTable.trx_id == trx_id,
    ).with_for_update()
    candidate_tx = (await db.execute(tx_stmt)).scalar_one_or_none()
    if not candidate_tx:
        return False

    alloc_stmt = select(AllocationTable).where(AllocationTable.transaction_id == candidate_tx.id)
    is_allocated = (await db.execute(alloc_stmt)).scalar_one_or_none() is not None or candidate_tx.reconciliation_state in ("used", "allocated")

    identities = await receipt_identities(db, order.shop_id, candidate_tx.id, provider, trx_id)
    digests = [(p, digest_calculator(order.shop_id, p, t)) for p, t in sorted(identities)]
    marker_stmt = select(UsedPaymentMarkerTable).where(
        UsedPaymentMarkerTable.shop_id == order.shop_id,
        tuple_(UsedPaymentMarkerTable.provider, UsedPaymentMarkerTable.transaction_digest).in_(digests),
    ).limit(1)
    marker_exists = (await db.execute(marker_stmt)).scalar_one_or_none() is not None

    from app.services.resolution_history import rejected_revisions
    rejected = await rejected_revisions(db, order.shop_id, candidate_tx.id)
    rejected_orders = set((await db.scalars(select(BuyerRevisionTable.order_id).where(
        BuyerRevisionTable.id.in_(rejected)))).all()) if rejected else set()
    if order_id in rejected_orders:
        await append_order_review_reasons_db(db, order_id, [COMPETING_CLAIMS], now)
        return False
    competing_order_ids = [oid for oid in competing_order_ids if oid not in rejected_orders]

    reasons = evaluate_candidate_match(
        order_account_id=str(order.payment_account_id),
        order_advance_minor=int(order.required_advance_minor),
        order_created_at=order.created_at,
        claim_amount_minor=claimed_amount,
        claim_sender_canonical=sender_canonical,
        claim_submission_time=claim_sub_time,
        tx_account_id=str(candidate_tx.payment_account_id),
        tx_amount_minor=int(candidate_tx.amount_minor),
        tx_sender_canonical=candidate_tx.sender_number_canonical,
        tx_occurred_at=candidate_tx.occurred_at,
        tx_has_conflict=candidate_tx.has_conflict,
        is_tx_allocated_or_used=is_allocated or marker_exists,
        competing_active_claims_count=len(competing_order_ids),
    )

    if reasons:
        await append_order_review_reasons_db(db, order_id, reasons, now)
        if len(competing_order_ids) > 1:
            for comp_id in competing_order_ids:
                if comp_id != order_id:
                    await append_order_review_reasons_db(db, comp_id, [COMPETING_CLAIMS], now)
        if PAYMENT_USED in reasons and is_allocated:
            # AC21 alert: notify/audit existing confirmed order of late competing claim
            existing_alloc = (await db.execute(select(AllocationTable).where(AllocationTable.transaction_id == candidate_tx.id))).scalar_one_or_none()
            if existing_alloc:
                db.add(AuditEventTable(
                    id=str(uuid.uuid4()),
                    shop_id=order.shop_id,
                    aggregate_type="order",
                    aggregate_id=str(existing_alloc.order_id),
                    actor="system",
                    action="late_claim_alert",
                    details=f"Late claim arrived on order {order.id} for used transaction {candidate_tx.id}",
                    created_at=now,
                ))
        return False

    ord_alloc = (await db.execute(select(AllocationTable).where(AllocationTable.order_id == order.id))).scalar_one_or_none()
    if ord_alloc is not None:
        return False

    alloc_id = str(uuid.uuid4())
    db.add(AllocationTable(
        id=alloc_id,
        shop_id=order.shop_id,
        order_id=order.id,
        transaction_id=candidate_tx.id,
        accepted_amount_minor=candidate_tx.amount_minor,
        basis="automatic",
        actor="system",
        reason=None,
        created_at=now,
    ))
    for identity_provider, digest in digests:
        db.add(UsedPaymentMarkerTable(
            id=str(uuid.uuid4()), shop_id=order.shop_id, provider=identity_provider,
            transaction_digest=digest, created_at=now,
        ))
    db.add(AuditEventTable(
        id=str(uuid.uuid4()),
        shop_id=order.shop_id,
        aggregate_type="order",
        aggregate_id=order.id,
        actor="system",
        action="order_confirmed_automatic",
        details=f"Automatically confirmed with transaction {candidate_tx.id} for amount {candidate_tx.amount_minor}",
        created_at=now,
    ))

    order.lifecycle = "confirmed"
    order.completed_at = now
    order.updated_at = now
    order.version = int(order.version) + 1

    candidate_tx.reconciliation_state = "used"
    candidate_tx.updated_at = now
    candidate_tx.version = int(candidate_tx.version) + 1

    await clear_order_review_reasons_db(db, order_id)
    # Callers project the accepted amount before committing the enclosing mutation.
    await db.flush()
    return True


async def reconcile_receipt_db(
    db: AsyncSession,
    transaction_id: str,
    now: datetime.datetime,
    digest_calculator: Callable[[str, str, str], str],
) -> List[str]:
    tx = (await db.execute(select(ReceivedTransactionTable).where(ReceivedTransactionTable.id == transaction_id))).scalar_one_or_none()
    if not tx:
        return []

    stmt = select(OrderTable.id).join(
        BuyerRevisionTable,
        (BuyerRevisionTable.order_id == OrderTable.id)
        & (BuyerRevisionTable.revision_number == OrderTable.buyer_revision),
    ).where(
        OrderTable.shop_id == tx.shop_id,
        OrderTable.lifecycle == "pending",
        BuyerRevisionTable.payment_provider == tx.provider,
        BuyerRevisionTable.payment_trx_id == clean_trx_id(tx.trx_id),
    ).distinct()
    matching_ids = [str(r) for r in (await db.execute(stmt)).scalars().all()]

    confirmed: List[str] = []
    for o_id in matching_ids:
        if await reconcile_order_db(db, o_id, now, digest_calculator, max_retries=1):
            confirmed.append(o_id)
    return confirmed


async def reconcile_all_pending_db(
    db: AsyncSession,
    shop_id: Optional[str],
    now: datetime.datetime,
    digest_calculator: Callable[[str, str, str], str],
) -> int:
    query = select(OrderTable.id).where(OrderTable.lifecycle == "pending")
    if shop_id:
        query = query.where(OrderTable.shop_id == shop_id)
    res = await db.execute(query)
    count = 0
    for o_id in res.scalars().all():
        if await reconcile_order_db(db, str(o_id), now, digest_calculator):
            count += 1
    return count
