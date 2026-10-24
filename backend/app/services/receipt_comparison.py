"""Private comparison projection shared by refetch and committed mutation responses."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import (
    BuyerRevisionTable,
    OrderReviewReasonTable,
    OrderTable,
    ReceivedTransactionTable,
    TransactionObservationTable,
)
from app.models.resolution import ClaimComparison, ReceiptComparison
from app.services.reconciliation import get_order_review_reasons
from app.services.reconciliation_queries import receipt_order_ids
from app.services.resolution_history import correction_history, resolution_history
from app.services.seller_service import NotFoundError
from app.services.transaction_store import _memory_observations, _memory_transactions, to_receipt_view


async def compare_receipt(db: AsyncSession | None, shop_id: str, receipt_id: str) -> ReceiptComparison:
    if db is not None:
        tx = await db.scalar(select(ReceivedTransactionTable).where(
            ReceivedTransactionTable.id == receipt_id, ReceivedTransactionTable.shop_id == shop_id))
        if tx is None:
            raise NotFoundError()
        observations = list((await db.scalars(select(TransactionObservationTable).where(
            TransactionObservationTable.transaction_id == receipt_id,
        ).order_by(TransactionObservationTable.created_at, TransactionObservationTable.id))).all())
        receipt = to_receipt_view(tx, observations)
        rows = (await db.execute(select(OrderTable, BuyerRevisionTable).join(
            BuyerRevisionTable, (BuyerRevisionTable.order_id == OrderTable.id)
            & (BuyerRevisionTable.revision_number == OrderTable.buyer_revision),
        ).where(OrderTable.shop_id == shop_id, BuyerRevisionTable.payment_provider == tx.provider,
                BuyerRevisionTable.payment_trx_id == tx.trx_id).order_by(OrderTable.id))).all()
        order_ids = [o.id for o, _ in rows]
        reason_rows = (await db.execute(select(OrderReviewReasonTable.order_id, OrderReviewReasonTable.reason).where(
            OrderReviewReasonTable.order_id.in_(order_ids)))).all()
        reasons_by_order: dict[str, list[str]] = {}
        for order_id, reason in reason_rows:
            reasons_by_order.setdefault(order_id, []).append(reason)
        claims = [ClaimComparison(order_id=o.id, revision_id=r.id, lifecycle=o.lifecycle,
                  buyer_name=r.buyer_name, sender_number=r.payment_sender_canonical,
                  amount_minor=r.payment_amount_minor, submitted_at=r.claim_accepted_at,
                  review_reasons=sorted(reasons_by_order.get(o.id, []))) for o, r in rows]
    else:
        from app.services.buyer_service import _memory_buyer_revisions
        from app.services.order_service import _memory_orders
        raw = _memory_transactions.get(receipt_id)
        if raw is None or raw["shop_id"] != shop_id:
            raise NotFoundError()
        receipt = to_receipt_view(raw, _memory_observations[receipt_id])
        claims = []
        for order_id, revisions in _memory_buyer_revisions.items():
            order = _memory_orders.get(order_id)
            if not order or order["shop_id"] != shop_id or not revisions:
                continue
            revision = revisions[-1]
            if revision["payment_provider"] != receipt.provider or revision["payment_trx_id"] != receipt.trx_id:
                continue
            claims.append(ClaimComparison(order_id=order_id, revision_id=revision["id"], lifecycle=order["lifecycle"],
                          buyer_name=revision["buyer_name"], sender_number=revision["payment_sender_canonical"],
                          amount_minor=revision["payment_amount_minor"], submitted_at=revision["claim_accepted_at"],
                          review_reasons=await get_order_review_reasons(None, order_id)))
    history = await resolution_history(db, shop_id, receipt_id)
    rejected = set(history[-1].rejected_revision_ids) if history else set()
    for claim in claims:
        claim.held_by_resolution = claim.revision_id in rejected
    receipt.related_claims_count = len(claims)
    allocations = await receipt_order_ids(db, shop_id, receipt_id)
    return ReceiptComparison(receipt=receipt, claims=claims, allocated_order_id=allocations[0] if allocations else None,
                             history=history, corrections=await correction_history(db, shop_id, receipt_id))
