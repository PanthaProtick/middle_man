"""Count new records across the shop without fetching paginated personal data."""
import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import ensure_durable_storage
from app.models.entities import OrderTable, PaymentAccountTable, ReceivedTransactionTable
from app.models.unseen_entries import UnseenEntryCounts, UnseenEntryQuery
from app.services.order_service import _memory_orders
from app.services.seller_service import _memory_accounts
from app.services.transaction_store import _memory_transactions


async def unseen_entry_counts(
    db: AsyncSession | None, shop_id: str, query: UnseenEntryQuery,
    now: datetime.datetime,
) -> UnseenEntryCounts:
    if db is None:
        ensure_durable_storage(db, "unseen entry counts")
    counts: dict[str, int] = {}
    for name, since, table, memory, retained_filter in (
        ("orders", query.orders_since, OrderTable, _memory_orders, OrderTable.retained_at.is_(None)),
        ("payments", query.payments_since, ReceivedTransactionTable, _memory_transactions,
         ReceivedTransactionTable.retained_at.is_(None)),
        ("accounts", query.accounts_since, PaymentAccountTable, _memory_accounts, None),
    ):
        if since is None:
            counts[name] = 0
        elif db is not None:
            statement = select(func.count()).select_from(table).where(
                table.shop_id == shop_id, table.created_at > since, table.created_at <= now,
            )
            if retained_filter is not None:
                statement = statement.where(retained_filter)
            counts[name] = int((await db.scalar(statement)) or 0)
        else:
            counts[name] = sum(
                1 for row in memory.values()
                if row["shop_id"] == shop_id and not row.get("retained_at")
                and since < row["created_at"] <= now
            )
    return UnseenEntryCounts(captured_at=now, **counts)
