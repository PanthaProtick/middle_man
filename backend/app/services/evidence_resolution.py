"""Explicit seller decisions reuse exact reconciliation and never release accepted funds."""
import uuid

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import get_utc_now
from app.models.entities import AuditEventTable, ReceivedTransactionTable, ShopTable
from app.models.resolution import ReceiptComparison, ResolutionDecision, ResolutionInput
from app.services.receipt_comparison import compare_receipt
from app.services.reconciliation import reconcile_receipt
from app.services.reconciliation_store import _memory_audit_events
from app.services.seller_service import SellerDomainException, StaleVersionError, compute_payload_hash
from app.services.transaction_store import _memory_transactions


async def resolve_evidence(db: AsyncSession | None, shop_id: str, actor: str, receipt_id: str,
                           payload: ResolutionInput, key: str) -> ReceiptComparison:
    for attempt in range(3):
        try:
            return await _resolve(db, shop_id, actor, receipt_id, payload, key)
        except DBAPIError as error:
            if db is not None:
                await db.rollback()
            if getattr(error.orig, "sqlstate", None) not in {"40001", "40P01"} or attempt == 2:
                raise
    raise RuntimeError("Resolution retries exhausted")


async def _resolve(db: AsyncSession | None, shop_id: str, actor: str, receipt_id: str,
                   payload: ResolutionInput, key: str) -> ReceiptComparison:
    if db is not None:
        # Same outer lock as imports, manual observations and claim admission.
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
    comparison = await compare_receipt(db, shop_id, receipt_id)
    scope = f"seller:{actor}:{receipt_id}"
    hashed = compute_payload_hash(payload.model_dump())
    cached = await check_idempotency_record(db, key, scope, "resolve_evidence", hashed)
    if cached:
        return ReceiptComparison.model_validate(cached[1])
    receipt = comparison.receipt
    if receipt.version != payload.expected_version:
        raise StaleVersionError("Evidence or claims changed. Refetch and compare before deciding.")
    if comparison.allocated_order_id or receipt.reconciliation_state == "used":
        raise SellerDomainException(409, "PAYMENT_USED", "Accepted allocation is locked. Later evidence remains an alert.")
    selected = next((o for o in receipt.observations if o.id == payload.selected_observation_id), None)
    if selected is None or selected.parse_state != "valid" or not selected.sender_number_canonical or not selected.occurred_at:
        raise SellerDomainException(422, "INCOMPLETE_EVIDENCE", "Select a complete observation belonging to this receipt.")
    if (selected.provider, selected.trx_id) != (receipt.provider, receipt.trx_id):
        raise SellerDomainException(409, "OBSERVATION_IDENTITY_CHANGED",
            "This observation has a previous identity. Correct the receipt identity explicitly before selecting it.")
    active = [c for c in comparison.claims if c.lifecycle == "pending"]
    if payload.selected_order_id is not None and not any(c.order_id == payload.selected_order_id for c in active):
        raise SellerDomainException(409, "CLAIM_CHANGED", "Selected claim is no longer pending. Refetch and compare.")
    now = get_utc_now()
    decision = ResolutionDecision(selected_observation_id=selected.id, selected_order_id=payload.selected_order_id,
        rejected_revision_ids=[c.revision_id for c in active if payload.selected_order_id and c.order_id != payload.selected_order_id],
        reason=payload.reason, actor=actor, created_at=now)
    event = dict(id=str(uuid.uuid4()), shop_id=shop_id, aggregate_type="transaction", aggregate_id=receipt_id,
                 actor=actor, action="evidence_resolved", details=decision.model_dump_json(), created_at=now)
    values = dict(payment_account_id=selected.payment_account_id, amount_minor=selected.amount_minor,
                  sender_number_raw=selected.sender_number_raw, sender_number_canonical=selected.sender_number_canonical,
                  occurred_at=selected.occurred_at, has_conflict=False, reconciliation_state="unmatched",
                  version=receipt.version + 1, updated_at=now)
    if db is not None:
        tx = await db.get(ReceivedTransactionTable, receipt_id)
        assert tx is not None
        for name, value in values.items():
            setattr(tx, name, value)
        db.add(AuditEventTable(**event))
        await db.flush()
    else:
        _memory_transactions[receipt_id].update(values)
        _memory_audit_events.append(event)
    await reconcile_receipt(db, receipt_id)
    result = await compare_receipt(db, shop_id, receipt_id)
    await save_idempotency_record(db, key, scope, "resolve_evidence", hashed, 200,
                                  result.model_dump(mode="json"), commit=False)
    if db is not None:
        await db.commit()
    return result
