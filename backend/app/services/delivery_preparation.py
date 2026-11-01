"""Shared query for confirmed orders that have not started courier submission.

Preparation means "no attempt at all". It is deliberately not `delivery_staged`
and not its negation: a failed attempt is still staged but belongs to the
separately categorized failed-submission case, so it must not re-enter this
work query.
"""
import datetime
from typing import Any, cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.tokens import get_utc_now
from app.models.courier_submission import CourierAttemptTable
from app.models.entities import OrderTable
from app.models.order import SellerOrder
from app.models.work_query import PreparationPreviewItem, PreparationQueryPreview, PreparationReason
from app.services.order_dates import DHAKA_ZONE
from app.services.order_mapping import to_seller_order, to_seller_order_from_dict
from app.services.reconciliation import get_order_allocation

PREPARATION_QUERY = "preparation"


def preparation_clause() -> ColumnElement[bool]:
    """Confirmed orders with no courier attempt in any state."""
    return (OrderTable.lifecycle == "confirmed") & ~select(CourierAttemptTable.id).where(
        CourierAttemptTable.order_id == OrderTable.id
    ).exists()


def memory_awaiting_preparation(order_id: str, raw: dict[str, Any]) -> bool:
    from app.services.courier_attempts import _memory_attempts

    return raw.get("lifecycle") == "confirmed" and not _memory_attempts.get(order_id)


def preparation_reasons(created_at: datetime.datetime, retrieved_at: datetime.datetime) -> list[PreparationReason]:
    reasons: list[PreparationReason] = ["AWAITING_COURIER_PREPARATION"]
    if _as_utc(created_at).astimezone(DHAKA_ZONE).date() < retrieved_at.astimezone(DHAKA_ZONE).date():
        reasons.append("PRIOR_DAY_BACKLOG")
    return reasons


def _as_utc(value: datetime.datetime) -> datetime.datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=datetime.timezone.utc)
    return value.astimezone(datetime.timezone.utc)


def _outstanding_value(record: OrderTable | dict[str, Any]) -> datetime.datetime:
    if isinstance(record, OrderTable):
        return record.completed_at or record.updated_at
    return cast(datetime.datetime, record.get("completed_at") or record["updated_at"])


def _item(order: SellerOrder, retrieved_at: datetime.datetime) -> PreparationPreviewItem:
    return PreparationPreviewItem(
        order=order,
        reason_codes=preparation_reasons(order.created_at, retrieved_at),
    )


def empty_preparation_preview(now: datetime.datetime | None = None) -> PreparationQueryPreview:
    retrieved_at = now or get_utc_now()
    return PreparationQueryPreview(
        items=[],
        total=0,
        next_cursor=None,
        retrieved_at=retrieved_at,
        calendar_date=retrieved_at.astimezone(DHAKA_ZONE).date(),
    )


async def preparation_preview(
    db: AsyncSession | None,
    shop_id: str,
    cursor: str | None = None,
    limit: int = 10,
    now: datetime.datetime | None = None,
) -> PreparationQueryPreview:
    """Return one stable page of the full authorized shop dataset."""
    retrieved_at = now or get_utc_now()
    limit = max(1, min(limit, 50))
    if db is not None:
        return await _database_preview(db, shop_id, cursor, limit, retrieved_at)
    return await _memory_preview(shop_id, cursor, limit, retrieved_at)


async def _database_preview(
    db: AsyncSession,
    shop_id: str,
    cursor: str | None,
    limit: int,
    retrieved_at: datetime.datetime,
) -> PreparationQueryPreview:
    base = (
        OrderTable.shop_id == shop_id,
        OrderTable.retained_at.is_(None),
        preparation_clause(),
    )
    total = int((await db.scalar(select(func.count()).select_from(OrderTable).where(*base))) or 0)
    outstanding = func.coalesce(OrderTable.completed_at, OrderTable.updated_at)
    query = select(OrderTable).where(*base)
    if cursor:
        cursor_order = (await db.scalars(
            select(OrderTable).where(OrderTable.id == cursor, OrderTable.shop_id == shop_id)
        )).first()
        if cursor_order is not None:
            cursor_key = _outstanding_value(cursor_order)
            query = query.where(
                (outstanding > cursor_key)
                | ((outstanding == cursor_key) & (OrderTable.id > cursor))
            )
    rows = (await db.scalars(
        query.order_by(outstanding.asc(), OrderTable.id.asc()).limit(limit + 1)
    )).all()
    page = rows[:limit]
    next_cursor = page[-1].id if len(rows) > limit and page else None
    items: list[PreparationPreviewItem] = []
    for row in page:
        allocation = await get_order_allocation(db, row.id)
        items.append(_item(to_seller_order(row, allocation), retrieved_at))
    return PreparationQueryPreview(
        items=items,
        total=total,
        next_cursor=next_cursor,
        retrieved_at=retrieved_at,
        calendar_date=retrieved_at.astimezone(DHAKA_ZONE).date(),
    )


async def _memory_preview(
    shop_id: str,
    cursor: str | None,
    limit: int,
    retrieved_at: datetime.datetime,
) -> PreparationQueryPreview:
    from app.services.order_service import _memory_orders

    candidates = [
        raw for raw in _memory_orders.values()
        if raw.get("shop_id") == shop_id
        and not raw.get("retained_at")
        and memory_awaiting_preparation(str(raw["id"]), raw)
    ]
    candidates.sort(key=lambda raw: (_outstanding_value(raw), str(raw["id"])))
    start = 0
    if cursor:
        for index, raw in enumerate(candidates):
            if str(raw["id"]) == cursor:
                start = index + 1
                break
        else:
            start = _insertion_point(candidates, cursor, shop_id)
    page = candidates[start:start + limit]
    next_cursor = page[-1]["id"] if start + limit < len(candidates) and page else None
    items: list[PreparationPreviewItem] = []
    for raw in page:
        allocation = await get_order_allocation(None, str(raw["id"]))
        items.append(_item(to_seller_order_from_dict(raw, allocation), retrieved_at))
    return PreparationQueryPreview(
        items=items,
        total=len(candidates),
        next_cursor=next_cursor,
        retrieved_at=retrieved_at,
        calendar_date=retrieved_at.astimezone(DHAKA_ZONE).date(),
    )


def _insertion_point(candidates: list[dict[str, Any]], cursor: str, shop_id: str) -> int:
    """Continue from an order that left the match set between pages."""
    from app.services.order_service import _memory_orders

    raw = _memory_orders.get(cursor)
    if not raw or raw.get("shop_id") != shop_id:
        return 0
    key = (_outstanding_value(raw), cursor)
    for index, candidate in enumerate(candidates):
        if (_outstanding_value(candidate), str(candidate["id"])) > key:
            return index
    return len(candidates)
