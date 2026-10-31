"""Whole-shop daily counts, independent of list filters and pagination."""
import datetime
from collections import Counter

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import ensure_durable_storage
from app.models.entities import OrderTable, ReceivedTransactionTable
from app.models.shop_metrics import TodayShopMetrics
from app.services.delivery_staging import memory_staged, staged_clause
from app.services.order_dates import DHAKA_ZONE, order_created_bounds, within_order_dates
from app.services.order_service import _memory_orders
from app.services.transaction_store import _memory_transactions


async def today_shop_metrics(
    db: AsyncSession | None, shop_id: str, now: datetime.datetime,
) -> TodayShopMetrics:
    day = now.astimezone(DHAKA_ZONE).date()
    start, end = order_created_bounds(day, day)
    if db is not None:
        lifecycle = case((
            (OrderTable.lifecycle == "awaiting_buyer") & (OrderTable.expires_at <= now),
            "expired",
        ), else_=OrderTable.lifecycle)
        rows = (await db.execute(select(lifecycle, func.count()).where(
            OrderTable.shop_id == shop_id, OrderTable.retained_at.is_(None),
            OrderTable.created_at >= start, OrderTable.created_at < end,
        ).group_by(lifecycle))).all()
        counts = Counter({str(state): int(count) for state, count in rows})
        staged = int((await db.scalar(select(func.count()).select_from(OrderTable).where(
            OrderTable.shop_id == shop_id, OrderTable.retained_at.is_(None),
            OrderTable.created_at >= start, OrderTable.created_at < end, staged_clause(),
        ))) or 0)
        payments = int((await db.scalar(select(func.count()).select_from(
            ReceivedTransactionTable,
        ).where(
            ReceivedTransactionTable.shop_id == shop_id,
            ReceivedTransactionTable.retained_at.is_(None),
            ReceivedTransactionTable.created_at >= start,
            ReceivedTransactionTable.created_at < end,
        ))) or 0)
    else:
        ensure_durable_storage(db, "daily shop metrics")
        counts = Counter(
            "expired" if raw["lifecycle"] == "awaiting_buyer" and raw["expires_at"] <= now
            else raw["lifecycle"]
            for raw in _memory_orders.values()
            if raw["shop_id"] == shop_id and not raw.get("retained_at")
            and within_order_dates(raw["created_at"], start, end)
        )
        staged = sum(
            1 for order_id, raw in _memory_orders.items()
            if raw["shop_id"] == shop_id and not raw.get("retained_at")
            and within_order_dates(raw["created_at"], start, end)
            and memory_staged(order_id, raw["lifecycle"])
        )
        payments = sum(
            1 for raw in _memory_transactions.values()
            if raw["shop_id"] == shop_id and not raw.get("retained_at")
            and within_order_dates(raw["created_at"], start, end)
        )
    return TodayShopMetrics(
        date=day, staged_for_delivery=staged, orders=sum(counts.values()), confirmed=counts["confirmed"],
        awaiting=counts["awaiting_buyer"], pending=counts["pending"], payments=payments,
    )
