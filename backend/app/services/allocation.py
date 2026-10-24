"""Shared atomic allocation write, called only after locked eligibility checks."""
import datetime
import json
import uuid
from typing import Any

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import (
    AllocationTable,
    AuditEventTable,
    OrderTable,
    ReceivedTransactionTable,
    UsedPaymentMarkerTable,
)
from app.models.payment_decision import PaymentSummary
from app.models.payment_metrics import PaymentMetricsTable


async def allocate_db(db: AsyncSession, order: OrderTable, receipt: ReceivedTransactionTable,
                      digests: list[tuple[str, str]], now: datetime.datetime, *,
                      basis: str, actor: str, reason: str | None, details: str) -> None:
    from app.services.reconciliation_db import clear_order_review_reasons_db
    exception = basis == 'manual' and bool(json.loads(details)['exceptions'])
    increment = insert(PaymentMetricsTable).values(shop_id=order.shop_id, confirmed_count=1,
        manual_count=int(basis == 'manual'), exception_count=int(exception))
    await db.execute(increment.on_conflict_do_update(index_elements=['shop_id'], set_={
        'confirmed_count': PaymentMetricsTable.confirmed_count + 1,
        'manual_count': PaymentMetricsTable.manual_count + int(basis == 'manual'),
        'exception_count': PaymentMetricsTable.exception_count + int(exception),
    }))
    alloc_id = str(uuid.uuid4())
    db.add(AllocationTable(
        id=alloc_id,
        shop_id=order.shop_id,
        order_id=order.id,
        transaction_id=receipt.id,
        accepted_amount_minor=receipt.amount_minor,
        basis=basis,
        actor=actor,
        reason=reason,
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
        actor=actor,
        action=f"order_confirmed_{basis}",
        details=details,
        created_at=now,
    ))

    order.lifecycle = "confirmed"
    order.completed_at = now
    order.updated_at = now
    order.version = int(order.version) + 1

    receipt.reconciliation_state = "used"
    receipt.updated_at = now
    receipt.version = int(receipt.version) + 1

    await clear_order_review_reasons_db(db, order.id)
    # Callers project the accepted amount before committing the enclosing mutation.
    await db.flush()



def allocate_memory(order: dict[str, Any], receipt: dict[str, Any], markers: set[tuple[str, str, str]],
                    now: datetime.datetime, *, basis: str, actor: str, reason: str | None, details: str) -> None:
    from app.services.payment_history import _memory_payment_metrics
    from app.services.reconciliation_store import (
        _memory_allocations,
        _memory_audit_events,
        _memory_order_allocations,
        _memory_order_review_reasons,
        _memory_transaction_allocations,
        _memory_used_payment_markers,
    )
    metric = _memory_payment_metrics.setdefault(order['shop_id'], PaymentSummary())
    metric.confirmed_count += 1
    metric.manual_count += int(basis == 'manual')
    metric.exception_count += int(basis == 'manual' and bool(json.loads(details)['exceptions']))
    order_id = order["id"]
    alloc_id = str(uuid.uuid4())
    _memory_allocations[alloc_id] = {
        "id": alloc_id,
        "shop_id": order["shop_id"],
        "order_id": order_id,
        "transaction_id": receipt["id"],
        "accepted_amount_minor": int(receipt["amount_minor"]),
        "basis": basis,
        "actor": actor,
        "reason": reason,
        "created_at": now,
    }
    _memory_order_allocations[order_id] = alloc_id
    _memory_transaction_allocations[receipt["id"]] = alloc_id
    _memory_used_payment_markers.update(markers)
    _memory_audit_events.append({
        "id": str(uuid.uuid4()),
        "shop_id": order["shop_id"],
        "aggregate_type": "order",
        "aggregate_id": order_id,
        "actor": actor,
        "action": f"order_confirmed_{basis}",
        "details": details,
        "created_at": now,
    })

    order["lifecycle"] = "confirmed"
    order["completed_at"] = now
    order["updated_at"] = now
    order["version"] = int(order.get("version", 1)) + 1

    receipt["reconciliation_state"] = "used"
    receipt["updated_at"] = now
    receipt["version"] = int(receipt.get("version", 1)) + 1

    _memory_order_review_reasons.pop(order_id, None)
