"""Revoke public authority atomically without changing the commercial order."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import get_utc_now
from app.models.entities import AuditEventTable, OrderTable, ShopTable
from app.models.link_access import RevokeBuyerLink
from app.models.order import SellerOrder
from app.services.order_mapping import to_seller_order, to_seller_order_from_dict
from app.services.order_service import _memory_orders
from app.services.reconciliation import get_order_allocation, get_order_review_reasons
from app.services.reconciliation_store import _memory_audit_events
from app.services.retention_access import require_retained_record
from app.services.seller_service import NotFoundError, StaleVersionError, compute_payload_hash


async def revoke_buyer_link(
    db: AsyncSession | None, shop_id: str, actor: str, order_id: str,
    payload: RevokeBuyerLink, key: str,
) -> SellerOrder:
    if db is not None:
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
        row = await db.scalar(select(OrderTable).where(
            OrderTable.id == order_id, OrderTable.shop_id == shop_id,
        ).with_for_update().execution_options(populate_existing=True))
        if row is None:
            raise NotFoundError("Order not found")
        raw = None
        version = row.version
        require_retained_record(row)
    else:
        row = None
        raw = _memory_orders.get(order_id)
        if raw is None or raw["shop_id"] != shop_id:
            raise NotFoundError("Order not found")
        version = int(raw["version"])
        require_retained_record(raw)
    scope = f"{shop_id}:{order_id}"
    hashed = compute_payload_hash(payload.model_dump())
    cached = await check_idempotency_record(db, key, scope, "revoke_buyer_link", hashed)
    if cached:
        return SellerOrder.model_validate(cached[1])
    if version != payload.expected_version:
        raise StaleVersionError("Order changed. Refresh before revoking its buyer link.")
    now = get_utc_now()
    already_revoked = row.buyer_link_revoked_at if row is not None else raw.get("buyer_link_revoked_at") if raw else None
    if not already_revoked:
        event = dict(id=str(uuid.uuid4()), shop_id=shop_id, aggregate_type="order",
                     aggregate_id=order_id, actor=actor, action="buyer_link_revoked", created_at=now)
        if row is not None:
            row.buyer_link_revoked_at = now
            row.version += 1
            row.updated_at = now
            assert db is not None
            db.add(AuditEventTable(**event))
        else:
            assert raw is not None
            raw.update(buyer_link_revoked_at=now, version=version + 1, updated_at=now)
            _memory_audit_events.append(event)
    allocation = await get_order_allocation(db, order_id)
    reasons = await get_order_review_reasons(db, order_id)
    if row is not None:
        result = to_seller_order(row, allocation, reasons)
    else:
        assert raw is not None
        result = to_seller_order_from_dict(raw, allocation, reasons)
    await save_idempotency_record(db, key, scope, "revoke_buyer_link", hashed, 200,
                                  result.model_dump(mode="json"), commit=False)
    if db is not None:
        await db.commit()
    return result
