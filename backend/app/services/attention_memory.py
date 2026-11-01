"""In-memory attention membership and pagination, mirroring the SQL query."""
import datetime
from typing import Any

from app.core.tokens import get_utc_now
from app.models.work_query import AttentionPreviewItem, AttentionQueryPreview
from app.services.attention_cursor import CursorKey, as_utc, decode_cursor, encode_cursor
from app.services.order_dates import DHAKA_ZONE
from app.services.order_mapping import to_seller_order_from_dict
from app.services.reconciliation import get_order_allocation

_ACTIVE_LIFECYCLES = ("pending", "confirmed")


def memory_attention_facts(
    order_id: str, raw: dict[str, Any]
) -> tuple[int, datetime.datetime] | None:
    """Category rank and outstanding timestamp using the last recorded attempt."""
    from app.services.courier_attempts import _memory_attempts

    lifecycle = raw.get("lifecycle")
    attempts = _memory_attempts.get(order_id) or []
    latest = attempts[-1] if attempts else None
    if lifecycle in _ACTIVE_LIFECYCLES and latest is not None:
        status = latest.get("status")
        if status in ("unknown", "failed"):
            outstanding = (
                _coerce(latest.get("updated_at"))
                or _coerce(latest.get("created_at"))
                or _coerce(raw.get("created_at"))
                or get_utc_now()
            )
            return (0 if status == "unknown" else 1, outstanding)
    if lifecycle == "pending" and not attempts:
        return 2, (
            _coerce(raw.get("first_submitted_at"))
            or _coerce(raw.get("created_at"))
            or get_utc_now()
        )
    if lifecycle == "confirmed" and not attempts:
        return 3, (
            _coerce(raw.get("completed_at"))
            or _coerce(raw.get("updated_at"))
            or get_utc_now()
        )
    return None


def _coerce(value: Any) -> datetime.datetime | None:
    if isinstance(value, datetime.datetime):
        return as_utc(value)
    if isinstance(value, str):
        try:
            return as_utc(datetime.datetime.fromisoformat(value))
        except ValueError:
            return None
    return None


async def memory_attention_preview(
    shop_id: str,
    cursor: str | None,
    limit: int,
    retrieved_at: datetime.datetime,
) -> AttentionQueryPreview:
    from app.services.order_service import _memory_orders

    candidates: list[tuple[dict[str, Any], int, datetime.datetime]] = []
    for raw in _memory_orders.values():
        order_id = str(raw["id"])
        if raw.get("shop_id") != shop_id or raw.get("retained_at"):
            continue
        facts = memory_attention_facts(order_id, raw)
        if facts is not None:
            candidates.append((raw, facts[0], facts[1]))
    candidates.sort(key=lambda entry: (entry[1], entry[2], str(entry[0]["id"])))
    start = _memory_start(candidates, cursor, shop_id)
    page = candidates[start:start + limit]
    next_cursor = (
        encode_cursor(page[-1][1], page[-1][2], str(page[-1][0]["id"]))
        if start + limit < len(candidates) and page else None
    )
    from app.services.attention import _item

    items: list[AttentionPreviewItem] = []
    for raw, rank, _ in page:
        allocation = await get_order_allocation(None, str(raw["id"]))
        items.append(_item(to_seller_order_from_dict(raw, allocation), rank, retrieved_at))
    return AttentionQueryPreview(
        items=items,
        total=len(candidates),
        next_cursor=next_cursor,
        retrieved_at=retrieved_at,
        calendar_date=retrieved_at.astimezone(DHAKA_ZONE).date(),
    )


def _memory_start(
    candidates: list[tuple[dict[str, Any], int, datetime.datetime]],
    cursor: str | None,
    shop_id: str,
) -> int:
    if not cursor:
        return 0
    key = _memory_cursor_key(cursor, shop_id)
    if key is None:
        return 0
    for index, (raw, rank, outstanding) in enumerate(candidates):
        if (rank, outstanding, str(raw["id"])) > (key.rank, key.outstanding, key.order_id):
            return index
    return len(candidates)


def _memory_cursor_key(cursor: str, shop_id: str) -> CursorKey | None:
    decoded = decode_cursor(cursor)
    if decoded is not None:
        return decoded
    from app.services.order_service import _memory_orders

    raw = _memory_orders.get(cursor)
    if not raw or raw.get("shop_id") != shop_id:
        return None
    facts = memory_attention_facts(cursor, raw)
    if facts is None:
        return None
    return CursorKey(facts[0], facts[1], cursor)
