"""Short atomic order actions: lookup waits for in-flight same-shop writes."""
import asyncio
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import ensure_durable_storage
from app.core.idempotency import check_idempotency_record
from app.models.entities import ShopTable
from app.models.order import SellerOrder
from app.services.seller_service import SellerDomainException

_epoch = uuid.uuid4().hex[:16]
_locks: dict[str, asyncio.Lock] = {}


def storage_epoch(db: AsyncSession | None) -> str:
    ensure_durable_storage(db, 'order submission')
    return 'durable' if db is not None else _epoch


def validate_submission_key(db: AsyncSession | None, key: str) -> None:
    if not key.startswith(storage_epoch(db) + '.'):
        raise SellerDomainException(409, 'SUBMISSION_STORAGE_RESET',
                                    'Submission storage changed. Review orders before starting a new action.')


@asynccontextmanager
async def order_creation_lock(db: AsyncSession | None, shop_id: str) -> AsyncIterator[None]:
    ensure_durable_storage(db, 'order creation')
    if db is not None:
        await db.execute(select(ShopTable).where(ShopTable.id == shop_id).with_for_update())
        yield
    else:
        async with _locks.setdefault(shop_id, asyncio.Lock()):
            yield


async def lookup_submission(db: AsyncSession | None, shop_id: str,
                            owner_id: str, key: str) -> SellerOrder | None:
    validate_submission_key(db, key)
    async with order_creation_lock(db, shop_id):
        cached = await check_idempotency_record(db, key, owner_id, 'create_order', None)
        if cached:
            order = SellerOrder.model_validate(cached[1])
            if order.shop_id == shop_id:
                return order
    return None
