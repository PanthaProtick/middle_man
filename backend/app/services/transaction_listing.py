"""Shop-scoped received-transaction listing with pushed-down search and paging."""
from typing import Any, List, Optional, Tuple

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import (
    PaymentAccountTable,
    ReceivedTransactionTable,
    TransactionObservationTable,
)
from app.models.transaction import ReceiptView
from app.services.transaction_search import (
    matches_transaction_search,
    transaction_search_clause,
)
from app.services.transaction_store import (
    _memory_observations,
    _memory_transactions,
    matches_transaction_filters,
    to_receipt_view,
)


def transaction_list_query(shop_id: str, search: Optional[str]) -> Any:
    """Shop-scoped, retained-free query with the search predicate in storage."""
    query = select(ReceivedTransactionTable).where(
        ReceivedTransactionTable.shop_id == shop_id,
        ReceivedTransactionTable.retained_at.is_(None),
    ).order_by(desc(ReceivedTransactionTable.created_at), desc(ReceivedTransactionTable.id))

    search_clause = transaction_search_clause(
        search,
        receipt_id=ReceivedTransactionTable.id,
        trx_id=ReceivedTransactionTable.trx_id,
        sender_number=ReceivedTransactionTable.sender_number_canonical,
        receiving_number=PaymentAccountTable.receiving_number,
        account_label=PaymentAccountTable.label,
    )
    if search_clause is not None:
        query = query.outerjoin(
            PaymentAccountTable,
            (PaymentAccountTable.id == ReceivedTransactionTable.payment_account_id)
            & (PaymentAccountTable.shop_id == shop_id),
        ).where(search_clause)
    return query


def _memory_account_identity(account_id: str) -> Tuple[Optional[str], Optional[str]]:
    """Resolve the seller-visible receiving account for an offline record."""
    from app.services.seller_service import _memory_accounts

    account = _memory_accounts.get(account_id, {})
    return account.get("receiving_number"), account.get("label")


def _memory_account_id(raw: dict[str, Any]) -> str:
    return str(raw.get("payment_account_id") or "")


def _memory_matches(
    raw: dict[str, Any],
    *,
    review_filter: Optional[str],
    used_filter: Optional[str],
    parse_filter: Optional[str],
    search: Optional[str],
) -> bool:
    if not matches_transaction_filters(
        bool(raw["has_conflict"]), raw["sender_number_canonical"], raw["occurred_at"],
        raw["reconciliation_state"], review_filter, used_filter, parse_filter,
    ):
        return False
    receiving_number, account_label = _memory_account_identity(_memory_account_id(raw))
    return matches_transaction_search(
        search,
        receipt_id=str(raw["id"]),
        trx_id=str(raw["trx_id"]),
        sender_number_canonical=raw.get("sender_number_canonical"),
        receiving_number=receiving_number,
        account_label=account_label,
    )


def _page_start(filtered: List[Any], cursor: Optional[str], key: str) -> int:
    if not cursor:
        return 0
    for index, item in enumerate(filtered):
        if item[key] == cursor:
            return index + 1
    return 0


async def list_shop_transactions(
    db: Optional[AsyncSession],
    *,
    shop_id: str,
    cursor: Optional[str] = None,
    limit: int = 25,
    review_filter: Optional[str] = None,
    used_filter: Optional[str] = None,
    parse_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> Tuple[List[ReceiptView], Optional[str]]:
    """List one shop's eligible receipts, filtering before cursor pagination."""
    if db is not None:
        result = await db.execute(transaction_list_query(shop_id, search))
        filtered = [
            row for row in result.scalars().all()
            if matches_transaction_filters(
                bool(row.has_conflict), row.sender_number_canonical, row.occurred_at,
                row.reconciliation_state, review_filter, used_filter, parse_filter,
            )
        ]
        start_index = next(
            (index + 1 for index, row in enumerate(filtered) if cursor and row.id == cursor), 0
        )
        page = filtered[start_index:start_index + limit]
        next_cursor = page[-1].id if (start_index + limit < len(filtered) and page) else None

        views: List[ReceiptView] = []
        for item in page:
            observations = (await db.execute(
                select(TransactionObservationTable).where(
                    TransactionObservationTable.transaction_id == item.id
                ).order_by(TransactionObservationTable.created_at.asc())
            )).scalars().all()
            views.append(to_receipt_view(item, list(observations)))
        return views, next_cursor

    all_raw = [
        raw for raw in _memory_transactions.values()
        if raw["shop_id"] == shop_id and not raw.get("retained_at")
    ]
    all_raw.sort(key=lambda raw: (raw["created_at"], raw["id"]), reverse=True)
    filtered_raw = [
        raw for raw in all_raw
        if _memory_matches(
            raw,
            review_filter=review_filter,
            used_filter=used_filter,
            parse_filter=parse_filter,
            search=search,
        )
    ]
    start = _page_start(filtered_raw, cursor, "id")
    page_raw = filtered_raw[start:start + limit]
    next_cursor = page_raw[-1]["id"] if (start + limit < len(filtered_raw) and page_raw) else None
    return [
        to_receipt_view(raw, _memory_observations.get(raw["id"], [])) for raw in page_raw
    ], next_cursor
