import datetime
import hashlib
import hmac
import uuid
from typing import Callable, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.tokens import get_utc_now
from app.models.buyer import clean_trx_id
from app.services.reconciliation_db import (
    clear_order_review_reasons_db,
    get_order_allocation_db,
    get_order_review_reasons_db,
    reconcile_all_pending_db,
    reconcile_order_db,
    reconcile_receipt_db,
)
from app.services.reconciliation_rules import (
    COMPETING_CLAIMS,
    PAYMENT_USED,
    AllocationRecord,
    evaluate_candidate_match,
)
from app.services.reconciliation_store import (
    _memory_allocations,
    _memory_audit_events,
    _memory_order_allocations,
    _memory_order_review_reasons,
    _memory_transaction_allocations,
    _memory_used_payment_markers,
)


def compute_payment_digest(shop_id: str, provider: str, trx_id: str) -> str:
    key = settings.CLERK_SECRET_KEY.strip()
    if not key:
        if settings.is_database_configured:
            # Enforce fail-closed security in configured database environments
            raise RuntimeError("Missing payment marker protection secret: failing closed")
        key = "standby-dev-marker-secret-seed"
    message = f"{shop_id}:{provider.lower().strip()}:{trx_id.strip()}"
    return hmac.new(key.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()


async def get_order_allocation(
    db: Optional[AsyncSession], order_id: str
) -> Optional[AllocationRecord]:
    if db is not None:
        return await get_order_allocation_db(db, order_id)
    alloc_id = _memory_order_allocations.get(order_id)
    if alloc_id and alloc_id in _memory_allocations:
        rec = _memory_allocations[alloc_id]
        return AllocationRecord(**rec)
    return None


async def get_order_review_reasons(
    db: Optional[AsyncSession], order_id: str
) -> List[str]:
    if db is not None:
        return await get_order_review_reasons_db(db, order_id)
    return list(_memory_order_review_reasons.get(order_id, []))


async def clear_order_review_reasons(
    db: Optional[AsyncSession], order_id: str
) -> None:
    if db is not None:
        await clear_order_review_reasons_db(db, order_id)
    else:
        _memory_order_review_reasons.pop(order_id, None)


async def reconcile_order(
    db: Optional[AsyncSession],
    order_id: str,
    clock: Callable[[], datetime.datetime] = get_utc_now,
) -> bool:
    now = clock()
    if db is not None:
        return await reconcile_order_db(db, order_id, now, compute_payment_digest)
    return await _reconcile_order_memory(order_id, now)


async def reconcile_receipt(
    db: Optional[AsyncSession],
    transaction_id: str,
    clock: Callable[[], datetime.datetime] = get_utc_now,
) -> List[str]:
    now = clock()
    if db is not None:
        return await reconcile_receipt_db(db, transaction_id, now, compute_payment_digest)
    return await _reconcile_receipt_memory(transaction_id, now)


async def reconcile_all_pending(
    db: Optional[AsyncSession],
    shop_id: Optional[str] = None,
    clock: Callable[[], datetime.datetime] = get_utc_now,
) -> int:
    now = clock()
    if db is not None:
        return await reconcile_all_pending_db(db, shop_id, now, compute_payment_digest)

    from app.services.order_service import _memory_orders
    count = 0
    for o_id, ord_data in list(_memory_orders.items()):
        if ord_data.get("lifecycle") == "pending" and (shop_id is None or ord_data.get("shop_id") == shop_id):
            if await _reconcile_order_memory(o_id, now):
                count += 1
    return count


async def _reconcile_order_memory(order_id: str, now: datetime.datetime) -> bool:
    from app.services.buyer_service import _memory_buyer_revisions
    from app.services.order_service import _memory_orders
    from app.services.transaction_store import _memory_transactions

    order = _memory_orders.get(order_id)
    if not order or order.get("lifecycle") != "pending":
        return False

    revisions = _memory_buyer_revisions.get(order_id, [])
    if not revisions:
        return False
    _memory_order_review_reasons.pop(order_id, None)
    active_rev = revisions[-1]

    provider = active_rev["payment_provider"]
    trx_id = clean_trx_id(active_rev["payment_trx_id"])
    claimed_amount = int(active_rev["payment_amount_minor"])
    claim_sub_time = active_rev.get("claim_accepted_at") or active_rev.get("created_at") or order.get("first_submitted_at") or now

    competing_order_ids = [
        o_id for o_id, rev_list in _memory_buyer_revisions.items()
        if o_id in _memory_orders
        and _memory_orders[o_id]["shop_id"] == order["shop_id"]
        and _memory_orders[o_id]["lifecycle"] == "pending"
        and rev_list
        and rev_list[-1]["payment_provider"] == provider
        and clean_trx_id(rev_list[-1]["payment_trx_id"]) == trx_id
    ]

    candidate_tx = next(
        (tx for tx in _memory_transactions.values()
         if tx["shop_id"] == order["shop_id"]
         and tx["provider"] == provider
         and clean_trx_id(tx["trx_id"]) == trx_id),
        None,
    )
    if not candidate_tx:
        return False

    from app.services.resolution_history import rejected_revisions
    rejected = await rejected_revisions(None, order["shop_id"], candidate_tx["id"])
    if active_rev["id"] in rejected:
        _memory_order_review_reasons[order_id] = sorted(set(_memory_order_review_reasons.get(order_id, []) + [COMPETING_CLAIMS]))
        return False
    competing_order_ids = [oid for oid in competing_order_ids if _memory_buyer_revisions[oid][-1]["id"] not in rejected]
    is_allocated = candidate_tx["id"] in _memory_transaction_allocations or candidate_tx.get("reconciliation_state") in ("used", "allocated")
    digest = compute_payment_digest(order["shop_id"], provider, trx_id)
    marker_exists = (order["shop_id"], provider, digest) in _memory_used_payment_markers

    reasons = evaluate_candidate_match(
        order_account_id=str(order["payment_account_id"]),
        order_advance_minor=int(order["required_advance_minor"]),
        order_created_at=order["created_at"],
        claim_amount_minor=claimed_amount,
        claim_sender_canonical=active_rev["payment_sender_canonical"],
        claim_submission_time=claim_sub_time,
        tx_account_id=str(candidate_tx["payment_account_id"]),
        tx_amount_minor=int(candidate_tx["amount_minor"]),
        tx_sender_canonical=candidate_tx.get("sender_number_canonical"),
        tx_occurred_at=candidate_tx.get("occurred_at"),
        tx_has_conflict=bool(candidate_tx.get("has_conflict")),
        is_tx_allocated_or_used=is_allocated or marker_exists,
        competing_active_claims_count=len(competing_order_ids),
    )

    if reasons:
        existing = _memory_order_review_reasons.get(order_id, [])
        _memory_order_review_reasons[order_id] = sorted(list(set(existing + reasons)))
        if len(competing_order_ids) > 1:
            for comp_id in competing_order_ids:
                if comp_id != order_id:
                    cur = _memory_order_review_reasons.get(comp_id, [])
                    _memory_order_review_reasons[comp_id] = sorted(list(set(cur + [COMPETING_CLAIMS])))
        if PAYMENT_USED in reasons and is_allocated:
            # AC21 alert: notify/audit existing confirmed order of late competing claim
            existing_alloc_id = _memory_transaction_allocations.get(candidate_tx["id"])
            if existing_alloc_id and existing_alloc_id in _memory_allocations:
                confirmed_ord_id = _memory_allocations[existing_alloc_id]["order_id"]
                _memory_audit_events.append({
                    "id": str(uuid.uuid4()),
                    "shop_id": order["shop_id"],
                    "aggregate_type": "order",
                    "aggregate_id": confirmed_ord_id,
                    "actor": "system",
                    "action": "late_claim_alert",
                    "details": f"Late claim arrived on order {order_id} for used transaction {candidate_tx['id']}",
                    "created_at": now,
                })
        return False

    alloc_id = str(uuid.uuid4())
    _memory_allocations[alloc_id] = {
        "id": alloc_id,
        "shop_id": order["shop_id"],
        "order_id": order_id,
        "transaction_id": candidate_tx["id"],
        "accepted_amount_minor": int(candidate_tx["amount_minor"]),
        "basis": "automatic",
        "actor": "system",
        "reason": None,
        "created_at": now,
    }
    _memory_order_allocations[order_id] = alloc_id
    _memory_transaction_allocations[candidate_tx["id"]] = alloc_id
    _memory_used_payment_markers.add((order["shop_id"], provider, digest))
    _memory_audit_events.append({
        "id": str(uuid.uuid4()),
        "shop_id": order["shop_id"],
        "aggregate_type": "order",
        "aggregate_id": order_id,
        "actor": "system",
        "action": "order_confirmed_automatic",
        "details": f"Automatically confirmed with transaction {candidate_tx['id']} for amount {candidate_tx['amount_minor']}",
        "created_at": now,
    })

    order["lifecycle"] = "confirmed"
    order["completed_at"] = now
    order["updated_at"] = now
    order["version"] = int(order.get("version", 1)) + 1

    candidate_tx["reconciliation_state"] = "used"
    candidate_tx["updated_at"] = now
    candidate_tx["version"] = int(candidate_tx.get("version", 1)) + 1

    _memory_order_review_reasons.pop(order_id, None)
    return True


async def _reconcile_receipt_memory(transaction_id: str, now: datetime.datetime) -> List[str]:
    from app.services.buyer_service import _memory_buyer_revisions
    from app.services.order_service import _memory_orders
    from app.services.transaction_store import _memory_transactions

    tx = _memory_transactions.get(transaction_id)
    if not tx:
        return []

    matching_order_ids = [
        o_id for o_id, rev_list in _memory_buyer_revisions.items()
        if o_id in _memory_orders
        and _memory_orders[o_id]["shop_id"] == tx["shop_id"]
        and _memory_orders[o_id]["lifecycle"] == "pending"
        and rev_list
        and rev_list[-1]["payment_provider"] == tx["provider"]
        and clean_trx_id(rev_list[-1]["payment_trx_id"]) == clean_trx_id(tx["trx_id"])
    ]

    confirmed: List[str] = []
    for o_id in matching_order_ids:
        if await _reconcile_order_memory(o_id, now):
            confirmed.append(o_id)
    return confirmed
