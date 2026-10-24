"""Receipt changes, matching and replay commit in the existing shop transaction."""
import uuid

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import get_utc_now
from app.models.entities import AuditEventTable, ReceivedTransactionTable, ShopTable, TransactionObservationTable
from app.models.receipt_correction import ReceiptCorrection, ReceiptCorrectionEvent, ReceiptSnapshot
from app.models.resolution import ReceiptComparison
from app.models.transaction import ManualReceipt
from app.services.receipt_comparison import compare_receipt
from app.services.reconciliation import compute_payment_digest, reconcile_order, reconcile_receipt
from app.services.reconciliation_db import reconcile_order_db
from app.services.reconciliation_store import _memory_audit_events
from app.services.seller_service import SellerDomainException, StaleVersionError, compute_payload_hash
from app.services.transaction_service import TransactionService
from app.services.transaction_store import _memory_observations, _memory_transactions


async def correct_receipt(db: AsyncSession | None, shop_id: str, actor: str, receipt_id: str,
                          payload: ReceiptCorrection, key: str) -> ReceiptComparison:
    for attempt in range(3):
        try:
            return await _correct(db, shop_id, actor, receipt_id, payload, key)
        except DBAPIError as error:
            if db is not None:
                await db.rollback()
            if getattr(error.orig, "sqlstate", None) not in {"40001", "40P01"} or attempt == 2:
                raise
    raise RuntimeError("Correction retries exhausted")


async def _correct(db: AsyncSession | None, shop_id: str, actor: str, receipt_id: str,
                   payload: ReceiptCorrection, key: str) -> ReceiptComparison:
    if db is not None:
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
    comparison = await compare_receipt(db, shop_id, receipt_id)
    scope = f"seller:{actor}:{receipt_id}"
    hashed = compute_payload_hash(payload.model_dump(exclude_unset=True))
    cached = await check_idempotency_record(db, key, scope, "correct_receipt", hashed)
    if cached:
        return ReceiptComparison.model_validate(cached[1])
    receipt = comparison.receipt
    if receipt.version != payload.expected_version:
        raise StaleVersionError("Evidence or claims changed. Refresh before correcting.")
    if comparison.allocated_order_id or receipt.reconciliation_state == "used":
        raise SellerDomainException(409, "PAYMENT_USED", "Accepted receipt fields are locked. Later contradictions remain alerts.")
    before = ReceiptSnapshot.model_validate({**receipt.model_dump(), "sender_number": receipt.sender_number_raw})
    try:
        corrected = ManualReceipt.model_validate({**before.model_dump(exclude={"has_conflict"}),
            **payload.model_dump(exclude_unset=True, exclude={"expected_version", "reason"})})
    except ValidationError:
        raise SellerDomainException(422, "INVALID_RECEIPT", "Check TrxID, sender and corrected receipt fields.") from None
    await TransactionService(db).verify_account(shop_id, corrected.payment_account_id, corrected.provider)
    if db is not None:
        collision = await db.scalar(select(ReceivedTransactionTable.id).where(
            ReceivedTransactionTable.shop_id == shop_id, ReceivedTransactionTable.provider == corrected.provider,
            ReceivedTransactionTable.trx_id == corrected.trx_id, ReceivedTransactionTable.id != receipt_id))
    else:
        collision = next((t["id"] for t in _memory_transactions.values() if t["shop_id"] == shop_id
            and t["provider"] == corrected.provider and t["trx_id"] == corrected.trx_id and t["id"] != receipt_id), None)
    if collision:
        raise SellerDomainException(409, "RECEIPT_IDENTITY_COLLISION",
            "This shop/provider/TrxID already exists. Compare and explicitly resolve the existing receipt; correction cannot merge funds.")
    now = get_utc_now()
    observation_id = str(uuid.uuid4())
    observation = dict(id=observation_id, transaction_id=receipt_id, payment_account_id=corrected.payment_account_id,
        provider=corrected.provider, trx_id=corrected.trx_id,
        source="manual", actor=actor, amount_minor=corrected.amount_minor, sender_number_raw=corrected.sender_number,
        sender_number_canonical=corrected.sender_number_canonical, occurred_at=corrected.occurred_at,
        parse_state="valid" if corrected.sender_number_canonical and corrected.occurred_at else "incomplete",
        conflict_state="none", created_at=now)
    event = ReceiptCorrectionEvent(before=before, after=ReceiptSnapshot(**corrected.model_dump(), has_conflict=False),
        observation_id=observation_id, reason=payload.reason, actor=actor, created_at=now)
    audit = dict(id=str(uuid.uuid4()), shop_id=shop_id, aggregate_type="transaction", aggregate_id=receipt_id,
        actor=actor, action="receipt_corrected", details=event.model_dump_json(), created_at=now)
    values = dict(payment_account_id=corrected.payment_account_id, provider=corrected.provider, trx_id=corrected.trx_id,
        amount_minor=corrected.amount_minor, sender_number_raw=corrected.sender_number,
        sender_number_canonical=corrected.sender_number_canonical, occurred_at=corrected.occurred_at,
        has_conflict=False, reconciliation_state="unmatched", version=receipt.version + 1, updated_at=now)
    if db is not None:
        tx = await db.get(ReceivedTransactionTable, receipt_id)
        assert tx is not None
        for name, value in values.items():
            setattr(tx, name, value)
        db.add(TransactionObservationTable(shop_id=shop_id, **observation))
        db.add(AuditEventTable(**audit))
        await db.flush()
    else:
        _memory_transactions[receipt_id].update(values)
        _memory_observations[receipt_id].append(observation)
        _memory_audit_events.append(audit)
    # Old-identity pending claims must lose obsolete review reasons too.
    if (receipt.provider, receipt.trx_id) != (corrected.provider, corrected.trx_id):
        for claim in comparison.claims:
            if claim.lifecycle == "pending":
                if db is None:
                    await reconcile_order(None, claim.order_id)
                else:
                    # Propagate conflicts to retry the whole mutation, never only its tail.
                    await reconcile_order_db(db, claim.order_id, now, compute_payment_digest, max_retries=1)
    await reconcile_receipt(db, receipt_id)
    result = await compare_receipt(db, shop_id, receipt_id)
    await save_idempotency_record(db, key, scope, "correct_receipt", hashed, 200,
        result.model_dump(mode="json"), commit=False)
    if db is not None:
        await db.commit()
    return result
