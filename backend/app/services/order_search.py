"""Shared order search normalization and matching for list and CSV export."""
import datetime
from typing import Any, Optional

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.models.entities import BuyerRevisionTable, OrderTable
from app.models.seller import canonicalize_bd_phone


def normalize_order_search(term: Optional[str]) -> Optional[str]:
    """Trim one seller-entered term; blank means no search constraint."""
    if term is None:
        return None
    cleaned = term.strip()
    return cleaned or None


def order_search_phone(term: str) -> Optional[str]:
    """Return the canonical Bangladesh number only for a complete phone input."""
    try:
        return canonicalize_bd_phone(term)
    except ValueError:
        return None


def order_search_clause(
    term: Optional[str],
    *,
    order_id: InstrumentedAttribute[Any],
    product_name: InstrumentedAttribute[Any],
    buyer_name: InstrumentedAttribute[Any],
    contact_number: InstrumentedAttribute[Any],
) -> Optional[ColumnElement[bool]]:
    """Build the OR predicate used by both the list and export database queries."""
    cleaned = normalize_order_search(term)
    if cleaned is None:
        return None
    lowered = cleaned.lower()
    clauses: list[ColumnElement[bool]] = [
        func.lower(order_id) == lowered,
        func.lower(product_name).contains(lowered, autoescape=True),
        func.lower(buyer_name).contains(lowered, autoescape=True),
    ]
    phone = order_search_phone(cleaned)
    if phone is not None:
        clauses.append(contact_number == phone)
    return or_(*clauses)


def order_list_query(
    *,
    shop_id: str,
    search: Optional[str],
    status_filter: Optional[str],
    now: datetime.datetime,
) -> Any:
    """Shop-scoped list query with search, current buyer join and expiry-aware status."""
    search_clause = order_search_clause(
        search,
        order_id=OrderTable.id,
        product_name=OrderTable.product_name,
        buyer_name=BuyerRevisionTable.buyer_name,
        contact_number=BuyerRevisionTable.contact_number_canonical,
    )
    query = select(OrderTable).where(
        OrderTable.shop_id == shop_id, OrderTable.retained_at.is_(None)
    )
    if search_clause is not None:
        query = query.outerjoin(
            BuyerRevisionTable,
            (BuyerRevisionTable.order_id == OrderTable.id)
            & (BuyerRevisionTable.revision_number == OrderTable.buyer_revision),
        ).where(search_clause)
    if status_filter:
        lifecycle = case((
            (OrderTable.lifecycle == 'awaiting_buyer') & (OrderTable.expires_at <= now), 'expired'
        ), else_=OrderTable.lifecycle)
        query = query.where(lifecycle == status_filter)
    return query


def order_after_cursor(query: Any, cursor_order: OrderTable) -> Any:
    """Keyset pagination for the created_at-desc, id-desc list order."""
    return query.where(or_(
        OrderTable.created_at < cursor_order.created_at,
        and_(
            OrderTable.created_at == cursor_order.created_at,
            OrderTable.id < cursor_order.id,
        ),
    ))


def memory_buyer_revision(order_id: str, revision_number: Optional[int]) -> dict[str, Any]:
    from app.services.buyer_service import _memory_buyer_revisions

    return next(
        (
            revision
            for revision in _memory_buyer_revisions.get(order_id, [])
            if revision['revision_number'] == revision_number
        ),
        {},
    )


def matches_order_search(
    term: Optional[str],
    *,
    order_id: str,
    product_name: str,
    buyer_name: str,
    contact_number_canonical: Optional[str],
) -> bool:
    """Offline equivalent of ``order_search_clause``."""
    cleaned = normalize_order_search(term)
    if cleaned is None:
        return True
    lowered = cleaned.casefold()
    if order_id.strip().casefold() == lowered:
        return True
    if lowered in product_name.casefold():
        return True
    if lowered in buyer_name.casefold():
        return True
    phone = order_search_phone(cleaned)
    return phone is not None and phone == contact_number_canonical
