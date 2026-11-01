import datetime
import hashlib
from typing import Any, List, Optional, Tuple

from sqlalchemy import desc, select

from app.core.idempotency import (
    reset_shared_idempotency_store,
)
from app.core.tokens import (
    get_utc_now,
)
from app.models.entities import OrderTable
from app.models.order import SellerOrder
from app.services.order_creation import OrderCreation
from app.services.order_dates import order_created_bounds, within_order_dates
from app.services.order_mapping import (
    check_and_apply_expiry,
    to_seller_order,
    to_seller_order_from_dict,
)
from app.services.order_search import (
    matches_order_search,
    memory_buyer_revision,
    order_after_cursor,
    order_list_query,
)
from app.services.order_store import memory_orders as _memory_orders
from app.services.order_store import memory_orders_by_digest as _memory_orders_by_digest
from app.services.reconciliation import get_order_allocation, get_order_review_reasons
from app.services.seller_service import (
    NotFoundError,
)

_check_and_apply_expiry = check_and_apply_expiry
_to_seller_order = to_seller_order
_to_seller_order_from_dict = to_seller_order_from_dict

__all__ = ['OrderService', 'reset_order_memory_store', '_memory_orders', '_memory_orders_by_digest']


def reset_order_memory_store() -> None:
    _memory_orders.clear()
    _memory_orders_by_digest.clear()
    reset_shared_idempotency_store()
    from app.services.buyer_service import reset_buyer_memory_store

    reset_buyer_memory_store()
    from app.services.reconciliation_store import reset_reconciliation_memory_store

    reset_reconciliation_memory_store()


class OrderService(OrderCreation):
    async def get_order(self, shop_id: str, order_id: str) -> SellerOrder:
        now = get_utc_now()
        if self.db is not None:
            stmt = select(OrderTable).where(OrderTable.id == order_id, OrderTable.shop_id == shop_id).with_for_update()
            order = (await self.db.execute(stmt)).scalar_one_or_none()
            if not order:
                raise NotFoundError("Order not found")

            if _check_and_apply_expiry(order, now):
                await self.db.commit()
                await self.db.refresh(order)
            alloc = await get_order_allocation(self.db, order.id) if order.lifecycle in ("confirmed", "cancelled") else None
            reasons = await get_order_review_reasons(self.db, order.id) if order.lifecycle == "pending" else []
            return _to_seller_order(order, alloc, reasons)

        raw = _memory_orders.get(order_id)
        if not raw or raw["shop_id"] != shop_id:
            raise NotFoundError("Order not found")

        _check_and_apply_expiry(raw, now)
        alloc = await get_order_allocation(None, order_id) if raw.get("lifecycle") in ("confirmed", "cancelled") else None
        reasons = await get_order_review_reasons(None, order_id) if raw.get("lifecycle") == "pending" else []
        return _to_seller_order_from_dict(raw, alloc, reasons)

    async def list_orders(
        self,
        shop_id: str,
        cursor: Optional[str] = None,
        limit: int = 25,
        status_filter: Optional[str] = None,
        review_filter: Optional[str] = None,
        search: Optional[str] = None,
        from_date: Optional[datetime.date] = None,
        to_date: Optional[datetime.date] = None,
    ) -> Tuple[List[SellerOrder], Optional[str]]:
        now = get_utc_now()
        limit = max(1, min(limit, 100))
        created_from, created_to = order_created_bounds(from_date, to_date)

        if self.db is not None:
            query = order_list_query(
                shop_id=shop_id,
                search=search,
                status_filter=status_filter,
                now=now,
                created_from=created_from,
                created_to=created_to,
            )
            if cursor:
                cursor_order = (await self.db.scalars(
                    query.where(OrderTable.id == cursor)
                )).first()
                if cursor_order is not None:
                    query = order_after_cursor(query, cursor_order)
            query = query.order_by(
                desc(OrderTable.created_at), desc(OrderTable.id)
            ).limit(limit + 1)

            orders = (await self.db.scalars(query)).all()
            for o in orders:
                if _check_and_apply_expiry(o, now):
                    await self.db.commit()

            page = orders[:limit]
            next_cursor = page[-1].id if len(orders) > limit and page else None
            res_orders: List[SellerOrder] = []
            for o in page:
                alloc = await get_order_allocation(self.db, o.id) if o.lifecycle in ("confirmed", "cancelled") else None
                reasons = await get_order_review_reasons(self.db, o.id) if o.lifecycle == "pending" else []
                res_orders.append(_to_seller_order(o, alloc, reasons))
            return res_orders, next_cursor

        all_raw = [o for o in _memory_orders.values() if o["shop_id"] == shop_id and not o.get('retained_at')]
        for raw in all_raw:
            _check_and_apply_expiry(raw, now)

        def matches(raw: dict[str, Any]) -> bool:
            if status_filter is not None and raw["lifecycle"] != status_filter:
                return False
            if not within_order_dates(raw["created_at"], created_from, created_to):
                return False
            buyer = memory_buyer_revision(str(raw["id"]), raw.get("buyer_revision"))
            return matches_order_search(
                search,
                order_id=str(raw["id"]),
                product_name=str(raw.get("product_name", "")),
                buyer_name=str(buyer.get("buyer_name", "")),
                contact_number_canonical=buyer.get("contact_number_canonical"),
            )

        filtered_raw = [o for o in all_raw if matches(o)]
        filtered_raw.sort(key=lambda x: (x["created_at"], x["id"]), reverse=True)

        start_idx = 0
        if cursor:
            for idx, item_dict in enumerate(filtered_raw):
                if item_dict["id"] == cursor:
                    start_idx = idx + 1
                    break

        page_raw = filtered_raw[start_idx : start_idx + limit]
        next_cursor = page_raw[-1]["id"] if (start_idx + limit < len(filtered_raw) and len(page_raw) > 0) else None
        res_orders_mem: List[SellerOrder] = []
        for raw_item in page_raw:
            alloc = await get_order_allocation(None, raw_item["id"]) if raw_item.get("lifecycle") in ("confirmed", "cancelled") else None
            reasons = await get_order_review_reasons(None, raw_item["id"]) if raw_item.get("lifecycle") == "pending" else []
            res_orders_mem.append(_to_seller_order_from_dict(raw_item, alloc, reasons))
        return res_orders_mem, next_cursor

    async def resolve_portal_token(self, shop_id: str, portal_token: str) -> str:
        digest = hashlib.sha256(portal_token.encode("utf-8")).hexdigest()
        if self.db is not None:
            order = (await self.db.execute(select(OrderTable).where(
                OrderTable.token_lookup_digest == digest, OrderTable.shop_id == shop_id
            ))).scalar_one_or_none()
            if not order:
                raise NotFoundError("Order not found")
            from app.services.retention_access import require_retained_record
            require_retained_record(order)
            return str(order.id)

        order_id = _memory_orders_by_digest.get(digest)
        if not order_id or order_id not in _memory_orders or _memory_orders[order_id]["shop_id"] != shop_id:
            raise NotFoundError("Order not found")
        from app.services.retention_access import require_retained_record
        require_retained_record(_memory_orders[order_id])
        return order_id
