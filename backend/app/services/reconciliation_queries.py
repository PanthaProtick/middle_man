"""Shop-scoped queries for the outcomes of received-payment reconciliation."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AllocationTable
from app.services.reconciliation_store import _memory_allocations


async def receipt_order_ids(db: AsyncSession | None, shop_id: str, receipt_id: str) -> list[str]:
    if db is not None:
        return list((await db.execute(select(AllocationTable.order_id).where(
            AllocationTable.shop_id == shop_id, AllocationTable.transaction_id == receipt_id,
        ))).scalars().all())
    return [str(a['order_id']) for a in _memory_allocations.values()
            if a['shop_id'] == shop_id and a['transaction_id'] == receipt_id]
