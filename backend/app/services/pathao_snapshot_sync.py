"""Bounded full hierarchy refresh, callable from seller actions or an operator worker."""
import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, AsyncSession

from app.core import database
from app.core.config import settings
from app.models.pathao import Environment, PathaoConnectionTable
from app.models.pathao_location import LocationChoice
from app.services import pathao_catalog as catalog
from app.services import pathao_connections as connections
from app.services import pathao_snapshot_jobs as jobs
from app.services import pathao_snapshot_store as store
from app.services.seller_service import SellerDomainException

logger = logging.getLogger(__name__)
_capacity = asyncio.Semaphore(2)


async def crawl(env: Environment, revision: connections.Revision) -> store.Tree:
    tree: store.Tree = {}
    total = 0
    async def load(level: catalog.Level, parent: int = 0) -> list[LocationChoice]:
        nonlocal total
        items = await read(level, parent or None)
        total += len(items)
        if total > 200000 or len(tree) >= 20000:
            raise ValueError('Catalogue exceeds synchronization bounds')
        tree[(level, parent)] = items
        return items
    async with catalog.reader(env, revision) as read:
        for city in await load('city'):
            for zone in await load('zone', city.id):
                if ('area', zone.id) in tree:
                    raise ValueError('Zone occurs beneath multiple cities')
                await load('area', zone.id)
    return tree


async def refresh(db: AsyncSession | None, shop: str, env: Environment, manual: bool = False) -> None:
    claim = await jobs.claim(db, shop, env, manual)
    if claim is None:
        return
    lease, gen = claim
    tree = None
    try:
        revision = await connections.latest(db, shop, env)
        async with asyncio.timeout(29 * 60), _capacity:
            tree = await crawl(env, revision)
    except (SellerDomainException, httpx.HTTPError, ValueError, TimeoutError):
        logger.warning('Pathao catalogue refresh failed; retaining the last complete catalogue.')
    await jobs.finish(db, shop, env, lease, gen, tree)


async def run_one(shop: str, env: Environment, manual: bool = False,
                  bind: AsyncEngine | AsyncConnection | None = None) -> None:
    """Own the session: request dependency sessions must never escape into background work."""
    if bind is not None:
        async with AsyncSession(bind=bind, expire_on_commit=False) as db:
            await refresh(db, shop, env, manual)
        return
    if database.AsyncSessionLocal is None:
        if not settings.is_durable_mode:
            await refresh(None, shop, env, manual)
        return
    async with database.AsyncSessionLocal() as db:
        await refresh(db, shop, env, manual)


async def run_due() -> None:
    if database.AsyncSessionLocal is None:
        raise RuntimeError('Catalogue worker requires a configured database')
    async with database.AsyncSessionLocal() as db:
        rows = (await db.execute(select(PathaoConnectionTable.shop_id, PathaoConnectionTable.environment).distinct())).all()
        await db.commit()
    for shop, env in rows:
        if env in ('offline', 'sandbox', 'production'):
            selected: Environment = 'offline' if env == 'offline' else 'sandbox' if env == 'sandbox' else 'production'
            await run_one(shop, selected)


if __name__ == '__main__':
    asyncio.run(run_due())
