"""Change public authority atomically without changing the commercial order."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.idempotency import check_idempotency_record, save_idempotency_record
from app.core.tokens import decrypt_token, generate_portal_token_materials, get_utc_now
from app.models.entities import AuditEventTable, OrderTable, ShopTable
from app.models.link_access import RevokeBuyerLink
from app.models.order import SellerOrder
from app.services.order_mapping import to_seller_order, to_seller_order_from_dict
from app.services.order_service import _memory_orders, _memory_orders_by_digest
from app.services.reconciliation import get_order_allocation, get_order_review_reasons
from app.services.reconciliation_store import _memory_audit_events
from app.services.retention_access import require_retained_record
from app.services.seller_service import NotFoundError, SellerDomainException, StaleVersionError, compute_payload_hash


async def change_buyer_link_access(
    db: AsyncSession | None, shop_id: str, actor: str, order_id: str,
    payload: RevokeBuyerLink, key: str,
    *, reissue: bool = False,
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
    operation = "reissue_buyer_link" if reissue else "revoke_buyer_link"
    cached = await check_idempotency_record(db, key, scope, operation, hashed)
    already_revoked = row.buyer_link_revoked_at if row is not None else raw.get("buyer_link_revoked_at") if raw else None
    if cached:
        if reissue:
            current_token = decrypt_token(row.encrypted_portal_token) if row is not None else raw["portal_token"] if raw else None
            if already_revoked or current_token != cached[1]["portal_token"]:
                raise SellerDomainException(409, "BUYER_LINK_SUPERSEDED", "This reissued link is no longer active. Refresh the order.")
        return SellerOrder.model_validate(cached[1])
    if version != payload.expected_version:
        raise StaleVersionError("Order changed. Refresh before changing its buyer link.")
    now = get_utc_now()
    if reissue:
        lifecycle = row.lifecycle if row is not None else raw["lifecycle"] if raw else None
        deadline = row.expires_at if row is not None else raw["expires_at"] if raw else now
        replaced = row.replaced_by_order_id if row is not None else raw.get("replaced_by_order_id") if raw else None
        if lifecycle in ("expired", "cancelled") or replaced or (lifecycle == "awaiting_buyer" and now >= deadline):
            raise SellerDomainException(409, "ORDER_NOT_REISSUABLE", "This order cannot receive a new buyer link.")
        token, digest, encrypted = generate_portal_token_materials()
        if row is not None:
            row.token_lookup_digest = digest
            row.encrypted_portal_token = encrypted
            row.buyer_link_revoked_at = None
        else:
            assert raw is not None
            _memory_orders_by_digest.pop(raw["token_lookup_digest"], None)
            _memory_orders_by_digest[digest] = order_id
            raw.update(token_lookup_digest=digest, encrypted_portal_token=encrypted,
                       portal_token=token, portal_url=f"/orders/{token}", buyer_link_revoked_at=None)
    if reissue or not already_revoked:
        event = dict(id=str(uuid.uuid4()), shop_id=shop_id, aggregate_type="order",
                     aggregate_id=order_id, actor=actor,
                     action="buyer_link_reissued" if reissue else "buyer_link_revoked", created_at=now)
        if row is not None:
            if not reissue:
                row.buyer_link_revoked_at = now
            row.version += 1
            row.updated_at = now
            assert db is not None
            db.add(AuditEventTable(**event))
        else:
            assert raw is not None
            raw.update(version=version + 1, updated_at=now)
            if not reissue:
                raw["buyer_link_revoked_at"] = now
            _memory_audit_events.append(event)
    allocation = await get_order_allocation(db, order_id)
    reasons = await get_order_review_reasons(db, order_id)
    if row is not None:
        result = to_seller_order(row, allocation, reasons)
    else:
        assert raw is not None
        result = to_seller_order_from_dict(raw, allocation, reasons)
    await save_idempotency_record(db, key, scope, operation, hashed, 200,
                                  result.model_dump(mode="json"), commit=False)
    if db is not None:
        await db.commit()
    return result
