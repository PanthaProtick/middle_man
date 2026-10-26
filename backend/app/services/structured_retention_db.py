"""Remove structured details; retain only tombstones and consumed-payment protection."""
from datetime import datetime

from sqlalchemy import delete, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.address_entities import AddressExtractionTable
from app.models.courier import CourierDraftTable
from app.models.entities import (
    AllocationTable,
    AuditEventTable,
    BuyerRevisionTable,
    LinkMeasurementTable,
    OrderReviewReasonTable,
    OrderTable,
    ReceivedTransactionTable,
    TransactionObservationTable,
)
from app.models.payment_entities import PaymentExtractionTable
from app.services.payment_marker_protection import verify_marker_key
from app.services.receipt_identity import receipt_identities
from app.services.retention_caches import redact_replays
from app.services.structured_retention import calendar_deadline


async def remove_receipt(db: AsyncSession, receipt: ReceivedTransactionTable, now: datetime) -> bool:
    identities = await receipt_identities(db, receipt.shop_id, receipt.id, receipt.provider, receipt.trx_id)
    claims = (await db.scalars(select(OrderTable).join(BuyerRevisionTable,
        BuyerRevisionTable.order_id == OrderTable.id).where(OrderTable.shop_id == receipt.shop_id,
        OrderTable.retained_at.is_(None), tuple_(BuyerRevisionTable.payment_provider,
        BuyerRevisionTable.payment_trx_id).in_(identities)))).all()
    if any(not o.completed_at or calendar_deadline(o.completed_at) > now for o in claims):
        return False
    allocation = await db.scalar(select(AllocationTable).where(AllocationTable.transaction_id == receipt.id))
    if allocation:
        # Validate every consumed historic identity before erasing its readable source.
        from app.models.entities import UsedPaymentMarkerTable
        from app.services.reconciliation import compute_payment_digest
        markers = set((await db.execute(select(UsedPaymentMarkerTable.provider,
            UsedPaymentMarkerTable.transaction_digest).where(UsedPaymentMarkerTable.shop_id == receipt.shop_id))).all())
        if any((p, compute_payment_digest(receipt.shop_id, p, t)) not in markers for p, t in identities):
            raise RuntimeError('Consumed identity marker missing')
    await redact_replays(db, {receipt.id}, receipt.shop_id)
    await db.execute(delete(TransactionObservationTable).where(TransactionObservationTable.transaction_id == receipt.id))
    await db.execute(delete(AuditEventTable).where(AuditEventTable.shop_id == receipt.shop_id,
        AuditEventTable.aggregate_id == receipt.id))
    if allocation:
        allocation.actor, allocation.reason = '', None
        allocation.accepted_amount_minor = 0
        # A nonspendable receipt skeleton preserves the unique allocation FK.
        receipt.trx_id = 'removed:' + receipt.id
        receipt.amount_minor = 0
        receipt.sender_number_raw = receipt.sender_number_canonical = None
        receipt.occurred_at = None
        receipt.reconciliation_state = 'used'
        receipt.has_conflict = False
        receipt.retained_at = now
    else:
        await db.delete(receipt)
    return True


async def remove_order(db: AsyncSession, order: OrderTable, now: datetime) -> None:
    await verify_marker_key(db, order.shop_id)
    revisions = (await db.scalars(select(BuyerRevisionTable).where(BuyerRevisionTable.order_id == order.id))).all()
    claim_ids = {(r.payment_provider, r.payment_trx_id) for r in revisions}
    receipt_ids = select(TransactionObservationTable.transaction_id).where(
        TransactionObservationTable.shop_id == order.shop_id,
        tuple_(TransactionObservationTable.provider, TransactionObservationTable.trx_id).in_(claim_ids))
    allocated = select(AllocationTable.transaction_id).where(AllocationTable.order_id == order.id)
    from sqlalchemy import or_
    receipts = (await db.scalars(select(ReceivedTransactionTable).where(
        ReceivedTransactionTable.shop_id == order.shop_id,
        or_(ReceivedTransactionTable.id.in_(receipt_ids), ReceivedTransactionTable.id.in_(allocated),
            tuple_(ReceivedTransactionTable.provider, ReceivedTransactionTable.trx_id).in_(claim_ids))))).all()
    for receipt in receipts:
        await remove_receipt(db, receipt, now)
    await redact_replays(db, {order.id, *(r.id for r in revisions)}, order.shop_id)
    await db.execute(delete(CourierDraftTable).where(CourierDraftTable.order_id == order.id))
    for model in (BuyerRevisionTable, OrderReviewReasonTable, AddressExtractionTable, PaymentExtractionTable):
        await db.execute(delete(model).where(model.order_id == order.id))
    await db.execute(delete(AuditEventTable).where(AuditEventTable.shop_id == order.shop_id,
        AuditEventTable.aggregate_id == order.id))
    await db.execute(delete(LinkMeasurementTable).where(LinkMeasurementTable.token_lookup_digest == order.token_lookup_digest))
    await db.execute(update(AllocationTable).where(AllocationTable.order_id == order.id).values(actor='', reason=None))
    order.product_name = order.account_receiving_number = order.account_label = order.encrypted_portal_token = ''
    order.total_minor = order.required_advance_minor = 0
    order.buyer_revision = None
    order.retained_at = order.retention_attempted_at = now
    order.retention_error = None
    order.version += 1
    await db.flush()
