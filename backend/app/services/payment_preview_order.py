"""Read-only order projection for advisory previews, without expiry writes or locks."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import OrderTable
from app.models.order import SellerOrder
from app.services.order_mapping import to_seller_order, to_seller_order_from_dict
from app.services.order_service import _memory_orders
from app.services.reconciliation import get_order_review_reasons
from app.services.retention_access import require_retained_record
from app.services.seller_service import NotFoundError


async def advisory_order(db: AsyncSession | None, shop_id: str, order_id: str) -> SellerOrder:
    reasons = await get_order_review_reasons(db, order_id)
    if db is not None:
        order = (await db.execute(select(OrderTable).where(
            OrderTable.id == order_id, OrderTable.shop_id == shop_id,
        ).execution_options(populate_existing=True))).scalar_one_or_none()
        if order is None:
            raise NotFoundError("Order not found")
        require_retained_record(order)
        return to_seller_order(order, None, reasons)
    raw = _memory_orders.get(order_id)
    if raw is None or raw['shop_id'] != shop_id:
        raise NotFoundError("Order not found")
    require_retained_record(raw)
    return to_seller_order_from_dict(raw, None, reasons)
