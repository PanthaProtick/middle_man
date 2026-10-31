"""Shared derived staging rules for seller labels and metrics."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models.courier import CourierDraftTable
from app.models.courier_submission import CourierAttemptTable
from app.models.entities import OrderTable
from app.models.order import SellerOrder


def staged_clause() -> ColumnElement[bool]:
    return (
        (OrderTable.lifecycle == "confirmed")
        & select(CourierDraftTable.order_id).where(
            CourierDraftTable.order_id == OrderTable.id).exists()
        & ~select(CourierAttemptTable.id).where(
            CourierAttemptTable.order_id == OrderTable.id,
            CourierAttemptTable.status.in_(("submitting", "success", "unknown")),
        ).exists()
    )


def memory_staged(order_id: str, lifecycle: str) -> bool:
    from app.services.courier_attempts import _memory_attempts
    from app.services.courier_drafts import _memory_drafts
    return lifecycle == "confirmed" and order_id in _memory_drafts and not any(
        attempt["status"] in ("submitting", "success", "unknown")
        for attempt in _memory_attempts.get(order_id, [])
    )


async def label_orders(db: AsyncSession | None, shop_id: str, orders: list[SellerOrder]) -> None:
    if not orders:
        return
    if db is not None:
        ids = set((await db.scalars(select(OrderTable.id).where(
            OrderTable.shop_id == shop_id, OrderTable.retained_at.is_(None),
            OrderTable.id.in_([order.id for order in orders]), staged_clause(),
        ))).all())
        for order in orders:
            order.delivery_staged = order.id in ids
    else:
        for order in orders:
            order.delivery_staged = memory_staged(order.id, order.lifecycle)
