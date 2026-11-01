"""Shared query for orders needing seller attention, with stable priority ordering.

Membership and category are decided by the order lifecycle and its *latest*
courier attempt; historical attempts never admit an order on their own. One order
appears at most once, in the highest-priority applicable category.
"""
import datetime
from typing import Any, cast

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.tokens import get_utc_now
from app.models.courier_submission import CourierAttemptTable
from app.models.entities import OrderTable
from app.models.order import SellerOrder
from app.models.work_query import (
    AttentionCategory,
    AttentionPreviewItem,
    AttentionQueryPreview,
    AttentionReason,
)
from app.services.attention_cursor import CursorKey, as_utc, decode_cursor, encode_cursor
from app.services.attention_memory import memory_attention_preview
from app.services.order_dates import DHAKA_ZONE
from app.services.order_mapping import to_seller_order
from app.services.reconciliation import get_order_allocation

ATTENTION_QUERY = "attention"

CATEGORY_BY_RANK: dict[int, AttentionCategory] = {
    0: "unknown_outcome",
    1: "failed_submission",
    2: "pending_review",
    3: "preparation",
}
REASON_BY_RANK: dict[int, AttentionReason] = {
    0: "UNKNOWN_OUTCOME",
    1: "FAILED_SUBMISSION",
    2: "PENDING_REVIEW",
    3: "AWAITING_COURIER_PREPARATION",
}
_ACTIVE_LIFECYCLES = ("pending", "confirmed")


def _latest_expr(column: Any) -> Any:
    return (
        select(column)
        .where(CourierAttemptTable.order_id == OrderTable.id)
        .order_by(CourierAttemptTable.attempt_number.desc(), CourierAttemptTable.id.desc())
        .limit(1)
        .correlate(OrderTable)
        .scalar_subquery()
    )


def _has_attempt() -> Any:
    return select(CourierAttemptTable.id).where(
        CourierAttemptTable.order_id == OrderTable.id
    ).exists()


def attention_category_expr() -> ColumnElement[Any]:
    """Numeric priority rank (0 highest) or NULL when the order needs nothing."""
    status = _latest_expr(CourierAttemptTable.status)
    active = OrderTable.lifecycle.in_(_ACTIVE_LIFECYCLES)
    return case(
        (active & (status == "unknown"), 0),
        (active & (status == "failed"), 1),
        ((OrderTable.lifecycle == "pending") & status.is_(None), 2),
        ((OrderTable.lifecycle == "confirmed") & ~_has_attempt(), 3),
        else_=None,
    )


def attention_outstanding_expr(category: ColumnElement[Any] | None = None) -> ColumnElement[Any]:
    rank = category if category is not None else attention_category_expr()
    attempt_time = func.coalesce(
        _latest_expr(CourierAttemptTable.updated_at),
        _latest_expr(CourierAttemptTable.created_at),
    )
    return case(
        (rank.in_((0, 1)), attempt_time),
        (rank == 2, func.coalesce(OrderTable.first_submitted_at, OrderTable.created_at)),
        else_=func.coalesce(OrderTable.completed_at, OrderTable.updated_at),
    )


def attention_clause() -> ColumnElement[bool]:
    """Any lifecycle/attempt combination that requires seller action."""
    clause: ColumnElement[bool] = attention_category_expr().is_not(None)
    return clause


def _after_cursor(rank: Any, outstanding: Any, cursor: CursorKey) -> ColumnElement[bool]:
    return cast(ColumnElement[bool], (
        (rank > cursor.rank)
        | ((rank == cursor.rank) & (outstanding > cursor.outstanding))
        | (
            (rank == cursor.rank)
            & (outstanding == cursor.outstanding)
            & (OrderTable.id > cursor.order_id)
        )
    ))


def attention_reasons(
    rank: int, created_at: datetime.datetime, retrieved_at: datetime.datetime
) -> list[AttentionReason]:
    reasons: list[AttentionReason] = [REASON_BY_RANK[rank]]
    if as_utc(created_at).astimezone(DHAKA_ZONE).date() < retrieved_at.astimezone(DHAKA_ZONE).date():
        reasons.append("PRIOR_DAY_BACKLOG")
    return reasons


def _item(order: SellerOrder, rank: int, retrieved_at: datetime.datetime) -> AttentionPreviewItem:
    return AttentionPreviewItem(
        order=order,
        category=CATEGORY_BY_RANK[rank],
        reason_codes=attention_reasons(rank, order.created_at, retrieved_at),
    )


def empty_attention_preview(now: datetime.datetime | None = None) -> AttentionQueryPreview:
    retrieved_at = now or get_utc_now()
    return AttentionQueryPreview(
        items=[],
        total=0,
        next_cursor=None,
        retrieved_at=retrieved_at,
        calendar_date=retrieved_at.astimezone(DHAKA_ZONE).date(),
    )


async def attention_preview(
    db: AsyncSession | None,
    shop_id: str,
    cursor: str | None = None,
    limit: int = 10,
    now: datetime.datetime | None = None,
) -> AttentionQueryPreview:
    retrieved_at = now or get_utc_now()
    limit = max(1, min(limit, 50))
    if db is not None:
        return await _database_preview(db, shop_id, cursor, limit, retrieved_at)
    return await memory_attention_preview(shop_id, cursor, limit, retrieved_at)


async def _database_preview(
    db: AsyncSession,
    shop_id: str,
    cursor: str | None,
    limit: int,
    retrieved_at: datetime.datetime,
) -> AttentionQueryPreview:
    rank = attention_category_expr()
    outstanding = attention_outstanding_expr(rank)
    base = (OrderTable.shop_id == shop_id, OrderTable.retained_at.is_(None), rank.is_not(None))
    total = int((await db.scalar(select(func.count()).select_from(OrderTable).where(*base))) or 0)
    query = select(OrderTable, rank.label("rank"), outstanding.label("outstanding")).where(*base)
    key = await _database_cursor_key(db, shop_id, cursor) if cursor else None
    if key is not None:
        query = query.where(_after_cursor(rank, outstanding, key))
    rows = (await db.execute(
        query.order_by(rank.asc(), outstanding.asc(), OrderTable.id.asc()).limit(limit + 1)
    )).all()
    page = rows[:limit]
    next_cursor = (
        encode_cursor(int(page[-1].rank), page[-1].outstanding, page[-1][0].id)
        if len(rows) > limit and page else None
    )
    items: list[AttentionPreviewItem] = []
    for row in page:
        allocation = await get_order_allocation(db, row[0].id)
        items.append(_item(to_seller_order(row[0], allocation), int(row.rank), retrieved_at))
    return AttentionQueryPreview(
        items=items,
        total=total,
        next_cursor=next_cursor,
        retrieved_at=retrieved_at,
        calendar_date=retrieved_at.astimezone(DHAKA_ZONE).date(),
    )


async def _database_cursor_key(
    db: AsyncSession, shop_id: str, cursor: str
) -> CursorKey | None:
    decoded = decode_cursor(cursor)
    if decoded is not None:
        return decoded
    rank = attention_category_expr()
    outstanding = attention_outstanding_expr(rank)
    row = (await db.execute(
        select(OrderTable.id, rank, outstanding).where(
            OrderTable.id == cursor, OrderTable.shop_id == shop_id
        )
    )).first()
    if row is None or row[1] is None:
        return None
    return CursorKey(int(row[1]), row[2], row[0])


__all__ = [
    "ATTENTION_QUERY",
    "attention_clause",
    "attention_preview",
    "empty_attention_preview",
]
