"""Calendar scheduling and restart-safe, shop-serialized structured cleanup."""
import calendar
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import OrderTable, ShopTable
from app.models.structured_retention import StructuredRetentionStatus
from app.services.order_mapping import check_and_apply_expiry


def calendar_deadline(completed: datetime) -> datetime:
    year = completed.year + 1
    return completed.replace(year=year, day=min(completed.day, calendar.monthrange(year, completed.month)[1]))


async def retention_status(db: AsyncSession | None, now: datetime, shop_id: str) -> StructuredRetentionStatus:
    if db is None:
        from app.services.order_service import _memory_orders
        rows = [r for r in _memory_orders.values() if r['shop_id'] == shop_id]
        due = [r for r in rows if not r.get('retained_at') and r.get('completed_at')
               and calendar_deadline(r['completed_at']) <= now]
        return StructuredRetentionStatus(checked_at=now, overdue=len(due),
            failed=sum(bool(r.get('retention_error')) for r in due), standby=True)
    rows_db = (await db.scalars(select(OrderTable).where(
        OrderTable.shop_id == shop_id, OrderTable.retained_at.is_(None)))).all()
    due_db = [r for r in rows_db if (r.completed_at and calendar_deadline(r.completed_at) <= now)
              or (r.lifecycle == 'awaiting_buyer' and calendar_deadline(r.expires_at) <= now)]
    return StructuredRetentionStatus(checked_at=now, overdue=len(due_db),
        failed=sum(bool(r.retention_error) for r in due_db))


async def purge_completed_orders(db: AsyncSession | None, now: datetime, shop_id: str) -> StructuredRetentionStatus:
    if db is None:
        from app.services.structured_retention_memory import purge_memory
        removed = await purge_memory(now, shop_id)
    else:
        from app.services.structured_retention_db import remove_order
        # Every money/claim writer uses shop -> order locks. Cleanup uses the same order.
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
        rows = (await db.scalars(select(OrderTable).where(
            OrderTable.shop_id == shop_id, OrderTable.retained_at.is_(None)).with_for_update())).all()
        removed = 0
        for row in rows:
            check_and_apply_expiry(row, now)
            if not row.completed_at or calendar_deadline(row.completed_at) > now:
                continue
            try:
                async with db.begin_nested():
                    await remove_order(db, row, now)
                removed += 1
            except Exception:
                # Persist a safe failure code, never driver messages containing personal data.
                row.retention_attempted_at = now
                row.retention_error = 'STRUCTURED_CLEANUP_FAILED'
        await db.commit()
    result = await retention_status(db, now, shop_id)
    result.removed = removed
    return result
