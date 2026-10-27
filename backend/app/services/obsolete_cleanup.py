"""Internal, explicit maintenance selection; never exposed by an HTTP route.

The operator must establish development-target identity and synthetic provenance
before calling this seam. Normal age-based retention never calls it.
"""
from typing import TypedDict

from sqlalchemy import delete, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import get_utc_now
from app.models.courier import CourierDraftTable
from app.models.entities import (
    AllocationTable,
    BuyerRevisionTable,
    OrderEvidenceTable,
    OrderTable,
    ReceivedTransactionTable,
    ShopTable,
    TransactionObservationTable,
)
from app.models.sms import ImportResult
from app.models.sms_entities import SmsEvidenceTable, SmsImportTable
from app.services.evidence_store import delete_evidence_file
from app.services.retention_caches import redact_replays
from app.services.structured_retention_db import remove_order


class CleanupResult(TypedDict):
    removed: list[str]
    already_removed: list[str]
    failed: list[str]


async def associated_receipts(db: AsyncSession, order: OrderTable) -> list[ReceivedTransactionTable]:
    claims = (await db.execute(select(BuyerRevisionTable.payment_provider,
        BuyerRevisionTable.payment_trx_id).where(BuyerRevisionTable.order_id == order.id))).all()
    identities = set(claims)
    observations = select(TransactionObservationTable.transaction_id).where(
        TransactionObservationTable.shop_id == order.shop_id,
        tuple_(TransactionObservationTable.provider, TransactionObservationTable.trx_id).in_(identities))
    allocated = select(AllocationTable.transaction_id).where(AllocationTable.order_id == order.id)
    return list((await db.scalars(select(ReceivedTransactionTable).where(
        ReceivedTransactionTable.shop_id == order.shop_id,
        or_(ReceivedTransactionTable.id.in_(allocated), ReceivedTransactionTable.id.in_(observations),
            tuple_(ReceivedTransactionTable.provider, ReceivedTransactionTable.trx_id).in_(identities))))).all())


async def erase_associated_sms(db: AsyncSession, shop_id: str, receipt_ids: set[str]) -> None:
    """Clear raw SMS only when every reference to that evidence is selected.

    Mixed imports retain their unrelated items. Shared raw messages fail closed
    rather than erase evidence belonging to a preserved receipt.
    """
    imports = (await db.scalars(select(SmsImportTable).where(SmsImportTable.shop_id == shop_id))).all()
    parsed = [ImportResult.model_validate_json(row.result_json) for row in imports]
    evidence_ids = {item.evidence_id for result in parsed for item in result.items
                    if item.receipt_id in receipt_ids}
    if any(item.evidence_id in evidence_ids and item.receipt_id not in receipt_ids
           for result in parsed for item in result.items):
        raise ValueError('Shared SMS evidence requires a narrower maintenance plan')
    for row, result in zip(imports, parsed, strict=True):
        changed = False
        for item in result.items:
            if item.evidence_id in evidence_ids:
                item.fields = None
                item.issues = ['record_unavailable']
                item.order_ids = []
                changed = True
        if changed:
            row.result_json = result.model_dump_json()
            row.payload_hash = ''
    await db.execute(delete(SmsEvidenceTable).where(
        SmsEvidenceTable.shop_id == shop_id, SmsEvidenceTable.id.in_(evidence_ids)))


async def cleanup_obsolete_orders(db: AsyncSession | None, targets: dict[str, str]) -> CleanupResult:
    """Erase a bounded order-ID -> shop-ID allowlist using the real current time.

    Invalid identity aborts before mutation; record failures roll back to their
    savepoint and are returned by ID, without leaking driver/private values.
    Storage-file deletion is idempotent but cannot be rolled back by PostgreSQL.
    """
    if db is None or not targets or len(targets) > 20:
        raise ValueError('A database and 1–20 positively identified orders are required')
    for shop_id in sorted(set(targets.values())):
        if await db.scalar(select(ShopTable).where(ShopTable.id == shop_id).with_for_update()) is None:
            raise ValueError('Unknown target shop')
    rows = list((await db.scalars(select(OrderTable).where(
        OrderTable.id.in_(targets)).order_by(OrderTable.id).with_for_update())).all())
    if len(rows) != len(targets) or any(row.shop_id != targets[row.id] for row in rows):
        raise ValueError('Target identity mismatch')
    result: CleanupResult = {'removed': [], 'already_removed': [], 'failed': []}
    selected = frozenset(targets)
    now = get_utc_now()
    for row in rows:
        order_id = row.id
        if row.retained_at:
            result['already_removed'].append(order_id)
            continue
        try:
            async with db.begin_nested():
                # This operation is for pre-courier data. Never erase booking history.
                if await db.scalar(select(CourierDraftTable.order_id).where(CourierDraftTable.order_id == order_id)):
                    raise ValueError('Courier order is outside this maintenance scope')
                receipts = await associated_receipts(db, row)
                receipt_ids = {r.id for r in receipts}
                # Refuse to erase any receipt still referenced by a preserved order.
                identities = {(r.provider, r.trx_id) for r in receipts}
                identities.update((await db.execute(select(TransactionObservationTable.provider,
                    TransactionObservationTable.trx_id).where(
                    TransactionObservationTable.transaction_id.in_(receipt_ids)))).all())
                shared = await db.scalar(select(BuyerRevisionTable.id).join(OrderTable,
                    BuyerRevisionTable.order_id == OrderTable.id).where(
                    OrderTable.shop_id == row.shop_id,
                    BuyerRevisionTable.order_id.not_in(selected),
                    tuple_(BuyerRevisionTable.payment_provider, BuyerRevisionTable.payment_trx_id).in_(identities)))
                allocation = await db.scalar(select(AllocationTable.id).where(
                    AllocationTable.transaction_id.in_(receipt_ids), AllocationTable.order_id.not_in(selected)))
                if shared or allocation:
                    raise ValueError('Receipt belongs to a preserved order')
                await erase_associated_sms(db, row.shop_id, receipt_ids)
                evidence = (await db.scalars(select(OrderEvidenceTable).where(
                    OrderEvidenceTable.order_id == order_id))).all()
                await redact_replays(db, {item.id for item in evidence}, row.shop_id)
                await remove_order(db, row, now, obsolete_order_ids=selected)
                for item in evidence:
                    if item.status != 'deleted':
                        delete_evidence_file(item.storage_key)
                    await db.delete(item)
                row.buyer_link_revoked_at = now
                await db.flush()
            result['removed'].append(order_id)
        except Exception:
            result['failed'].append(order_id)
    await db.commit()
    return result
