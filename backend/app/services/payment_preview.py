"""Locked eligibility and preview for explicit acceptance of seller supplied funds."""
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import BuyerRevisionTable, UsedPaymentMarkerTable
from app.models.payment_decision import PaymentPreview
from app.services.buyer_service import _memory_buyer_revisions
from app.services.order_service import OrderService
from app.services.receipt_comparison import compare_receipt
from app.services.receipt_identity import receipt_identities
from app.services.reconciliation import compute_payment_digest, get_order_allocation
from app.services.reconciliation_rules import evaluate_candidate_match
from app.services.reconciliation_store import _memory_used_payment_markers
from app.services.seller_service import SellerDomainException


async def payment_preview(db: AsyncSession | None, shop_id: str, order_id: str, receipt_id: str) -> PaymentPreview:
    order = await OrderService(db).get_order(shop_id, order_id)
    comparison = await compare_receipt(db, shop_id, receipt_id)
    receipt = comparison.receipt
    if order.lifecycle != 'pending' or not order.buyer_revision:
        raise SellerDomainException(409, 'ORDER_NOT_PENDING', 'Only pending buyer submissions can be accepted.')
    if db is not None:
        revision = (await db.execute(select(BuyerRevisionTable).where(
            BuyerRevisionTable.order_id == order_id,
            BuyerRevisionTable.revision_number == order.buyer_revision))).scalar_one()
        provider, trx_id, sender, amount, submitted = (revision.payment_provider, revision.payment_trx_id,
            revision.payment_sender_canonical, revision.payment_amount_minor, revision.claim_accepted_at)
    else:
        raw = _memory_buyer_revisions[order_id][-1]
        provider, trx_id, sender, amount, submitted = (raw['payment_provider'], raw['payment_trx_id'],
            raw['payment_sender_canonical'], raw['payment_amount_minor'], raw['claim_accepted_at'])
    identities = await receipt_identities(db, shop_id, receipt.id, receipt.provider, receipt.trx_id)
    digests = [(p, compute_payment_digest(shop_id, p, t)) for p, t in sorted(identities)]
    if db is not None:
        used = await db.scalar(select(UsedPaymentMarkerTable.id).where(
            UsedPaymentMarkerTable.shop_id == shop_id,
            tuple_(UsedPaymentMarkerTable.provider, UsedPaymentMarkerTable.transaction_digest).in_(digests)).limit(1)) is not None
    else:
        used = any((shop_id, p, digest) in _memory_used_payment_markers for p, digest in digests)
    active = [c for c in comparison.claims if c.lifecycle == 'pending' and not c.held_by_resolution]
    reasons = evaluate_candidate_match(order.payment_account_id, order.required_advance_minor, order.created_at,
        amount, sender, submitted, receipt.payment_account_id, receipt.amount_minor, receipt.sender_number_canonical,
        receipt.occurred_at, receipt.has_conflict,
        used or comparison.allocated_order_id is not None or receipt.reconciliation_state in ('used', 'allocated'), len(active))
    if provider != receipt.provider or order.account_provider != receipt.provider:
        reasons.append('PROVIDER_MISMATCH')
    blockers = [r for r in reasons if r in ('PAYMENT_USED', 'COMPETING_CLAIMS', 'CONFLICTING_RECEIPTS')]
    if await get_order_allocation(db, order_id):
        blockers.append('PAYMENT_USED')
    if trx_id != receipt.trx_id:
        blockers.append('TRANSACTION_ID_MISMATCH')
    if any(c.order_id == order_id and c.held_by_resolution for c in comparison.claims):
        blockers.append('COMPETING_CLAIMS')
    # A provider exception cannot silently take another pending order's receipt.
    if any(c.order_id != order_id for c in active):
        blockers.append('COMPETING_CLAIMS')
    if receipt.amount_minor > order.total_minor:
        blockers.append('PAYMENT_EXCEEDS_TOTAL')
    return PaymentPreview(order_id=order_id, expected_version=order.version,
        expected_transaction_version=receipt.version, receipt=receipt, claim_provider=provider,
        claim_trx_id=trx_id, claim_sender=sender, claim_amount_minor=amount, claim_submitted_at=submitted,
        order_created_at=order.created_at, account_provider=order.account_provider,
        payment_account_id=order.payment_account_id, total_minor=order.total_minor,
        required_advance_minor=order.required_advance_minor, accepted_amount_minor=receipt.amount_minor,
        actual_cod_minor=order.total_minor-receipt.amount_minor if receipt.amount_minor <= order.total_minor else None,
        exceptions=sorted(set(reasons)-set(blockers)), blockers=sorted(set(blockers)))
