"""Atomic replacement of unallocated predecessor orders with new terms and token."""
import datetime
import json
import uuid

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import generate_portal_token_materials, get_utc_now
from app.models.entities import AuditEventTable, OrderTable, ShopTable
from app.models.order import SellerOrder
from app.models.replacement import OrderReplacementInput
from app.services.order_service import (
    OrderService,
    _memory_orders,
    _memory_orders_by_digest,
)
from app.services.reconciliation import get_order_allocation
from app.services.reconciliation_store import _memory_audit_events
from app.services.seller_service import (
    SellerDomainException,
    StaleVersionError,
    compute_payload_hash,
)


async def replace_order(
    db: AsyncSession | None,
    shop_id: str,
    actor: str,
    predecessor_id: str,
    payload: OrderReplacementInput,
    idempotency_key: str,
) -> SellerOrder:
    for attempt in range(3):
        try:
            return await _replace(db, shop_id, actor, predecessor_id, payload, idempotency_key)
        except DBAPIError as error:
            if db is not None:
                await db.rollback()
            if getattr(error.orig, "sqlstate", None) not in {"40001", "40P01"} or attempt == 2:
                raise
    raise RuntimeError("Replacement retries exhausted")


async def _replace(
    db: AsyncSession | None,
    shop_id: str,
    actor: str,
    predecessor_id: str,
    payload: OrderReplacementInput,
    idempotency_key: str,
) -> SellerOrder:
    if db is not None:
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())

    order_svc = OrderService(db)
    predecessor = await order_svc.get_order(shop_id, predecessor_id)

    scope = f"seller:{actor}:{predecessor_id}"
    hashed = compute_payload_hash(payload.model_dump())
    cached = await check_idempotency_record(db, idempotency_key, scope, "replace_order", hashed)
    if cached:
        return SellerOrder.model_validate(cached[1])

    if predecessor.version != payload.expected_version:
        raise StaleVersionError("Predecessor order changed. Refresh before replacing.")

    alloc = await get_order_allocation(db, predecessor_id)
    if predecessor.lifecycle == "confirmed" or predecessor.allocation_basis is not None or alloc is not None:
        raise SellerDomainException(
            409,
            "PAYMENT_RESOLUTION_REQUIRED",
            "Allocated predecessors require separate payment resolution; replacement is not allowed for confirmed orders.",
        )

    if predecessor.replaced_by_order_id is not None:
        raise SellerDomainException(409, "ORDER_ALREADY_REPLACED", "Order has already been replaced.")

    if predecessor.lifecycle not in ("awaiting_buyer", "pending", "expired"):
        raise SellerDomainException(
            409,
            "INVALID_LIFECYCLE",
            f"Cannot replace order in {predecessor.lifecycle} status",
        )

    provider, receiving_number, label = await order_svc._get_account_snapshot(
        shop_id, payload.order.payment_account_id
    )

    now = get_utc_now()
    expires_at = now + datetime.timedelta(hours=48)
    new_order_id = str(uuid.uuid4())
    raw_token, digest, encrypted = generate_portal_token_materials()

    pred_details = json.dumps({
        "reason": payload.reason,
        "replacement_order_id": new_order_id,
        "order_version": payload.expected_version,
    })
    new_details = json.dumps({
        "reason": payload.reason,
        "predecessor_order_id": predecessor_id,
    })

    # For expired orders, preserve terminal expired lifecycle; for active orders, cancel them.
    pred_lifecycle = predecessor.lifecycle if predecessor.lifecycle == "expired" else "cancelled"

    if db is not None:
        pred_row = (await db.execute(
            select(OrderTable).where(OrderTable.id == predecessor_id).with_for_update()
        )).scalar_one()

        new_row = OrderTable(
            id=new_order_id,
            shop_id=shop_id,
            payment_account_id=payload.order.payment_account_id,
            token_lookup_digest=digest,
            encrypted_portal_token=encrypted,
            product_name=payload.order.product_name,
            total_minor=payload.order.total_minor,
            required_advance_minor=payload.order.required_advance_minor,
            account_provider=provider,
            account_receiving_number=receiving_number,
            account_label=label,
            lifecycle="awaiting_buyer",
            version=1,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            completed_at=None,
            predecessor_order_id=predecessor_id,
            replaced_by_order_id=None,
        )
        db.add(new_row)
        await db.flush()

        pred_row.lifecycle = pred_lifecycle
        pred_row.version += 1
        pred_row.completed_at = pred_row.completed_at or now
        pred_row.replaced_by_order_id = new_order_id
        pred_row.updated_at = now

        db.add(AuditEventTable(
            id=str(uuid.uuid4()), shop_id=shop_id, aggregate_type="order",
            aggregate_id=predecessor_id, actor=actor, action="order_replaced",
            details=pred_details, created_at=now,
        ))
        db.add(AuditEventTable(
            id=str(uuid.uuid4()), shop_id=shop_id, aggregate_type="order",
            aggregate_id=new_order_id, actor=actor, action="order_created_replacement",
            details=new_details, created_at=now,
        ))
        await db.flush()
    else:
        pred_raw = _memory_orders[predecessor_id]
        pred_raw["lifecycle"] = pred_lifecycle
        pred_raw["version"] = int(pred_raw.get("version", 1)) + 1
        pred_raw["completed_at"] = pred_raw.get("completed_at") or now
        pred_raw["replaced_by_order_id"] = new_order_id
        pred_raw["updated_at"] = now

        _memory_orders[new_order_id] = {
            "id": new_order_id,
            "shop_id": shop_id,
            "payment_account_id": payload.order.payment_account_id,
            "token_lookup_digest": digest,
            "encrypted_portal_token": encrypted,
            "product_name": payload.order.product_name,
            "total_minor": payload.order.total_minor,
            "required_advance_minor": payload.order.required_advance_minor,
            "expected_cod_minor": payload.order.total_minor - payload.order.required_advance_minor,
            "actual_cod_minor": None,
            "account_provider": provider,
            "account_receiving_number": receiving_number,
            "account_label": label,
            "lifecycle": "awaiting_buyer",
            "version": 1,
            "portal_token": raw_token,
            "portal_url": f"/orders/{raw_token}",
            "created_at": now,
            "updated_at": now,
            "expires_at": expires_at,
            "completed_at": None,
            "predecessor_order_id": predecessor_id,
            "replaced_by_order_id": None,
        }
        _memory_orders_by_digest[digest] = new_order_id
        _memory_audit_events.append({
            "id": str(uuid.uuid4()), "shop_id": shop_id, "aggregate_type": "order",
            "aggregate_id": predecessor_id, "actor": actor, "action": "order_replaced",
            "details": pred_details, "created_at": now,
        })
        _memory_audit_events.append({
            "id": str(uuid.uuid4()), "shop_id": shop_id, "aggregate_type": "order",
            "aggregate_id": new_order_id, "actor": actor, "action": "order_created_replacement",
            "details": new_details, "created_at": now,
        })

    result = await order_svc.get_order(shop_id, new_order_id)
    await save_idempotency_record(
        db, idempotency_key, scope, "replace_order", hashed, 201,
        result.model_dump(mode="json"), commit=False,
    )
    if db is not None:
        await db.commit()
    return result
