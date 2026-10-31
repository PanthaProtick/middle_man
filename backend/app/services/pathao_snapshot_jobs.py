"""Short locked refresh claims and atomic publication; no locks during provider I/O."""
import datetime as dt
import json
from dataclasses import dataclass
from uuid import uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import get_utc_now
from app.models.entities import ShopTable
from app.models.pathao import Environment
from app.models.pathao_snapshot import CatalogListTable, CatalogSnapshotTable, CatalogStatus, CatalogSyncTable
from app.services import pathao_connections as connections
from app.services import pathao_snapshot_store as store


@dataclass
class Job:
    connection_version: int
    lease_id: str | None = None
    lease_until: dt.datetime | None = None
    attempted_at: dt.datetime | None = None
    failed: bool = False


_jobs: dict[tuple[str, Environment], Job] = {}


async def status(db: AsyncSession | None, shop: str, env: Environment) -> CatalogStatus:
    saved = await store.snapshot(db, shop, env)
    gen = await connections.generation(db, shop, env)
    job = _jobs.get((shop, env)) if db is None else await db.get(CatalogSyncTable, (shop, env), populate_existing=True)
    result = CatalogStatus(catalog_version=saved.id if saved else None, refreshed_at=saved.created_at if saved else None)
    if job and job.connection_version == gen:
        result.attempted_at = job.attempted_at
        result.refreshing = bool(job.lease_until and job.lease_until > get_utc_now())
        result.failed = job.failed or bool(job.lease_id and not result.refreshing)
    if db is not None:
        await db.commit()
    return result


async def claim(db: AsyncSession | None, shop: str, env: Environment, manual: bool) -> tuple[str, int] | None:
    saved = await store.snapshot(db, shop, env)
    if db is not None:
        await db.scalar(select(ShopTable.id).where(ShopTable.id == shop).with_for_update())
    gen = await connections.generation(db, shop, env)
    job = _jobs.get((shop, env)) if db is None else await db.get(CatalogSyncTable, (shop, env), populate_existing=True)
    now = get_utc_now()
    same = job is not None and job.connection_version == gen
    busy = same and job is not None and job.lease_until is not None and job.lease_until > now
    cooldown = same and job is not None and job.attempted_at is not None and now < job.attempted_at + dt.timedelta(minutes=1 if manual else 60)
    fresh = not manual and saved is not None and saved.generation == gen and now < saved.created_at + dt.timedelta(days=1)
    if not gen or busy or cooldown or fresh:
        if db is not None:
            await db.commit()
        return None
    lease = str(uuid4())
    if job is None:
        job = Job(gen) if db is None else CatalogSyncTable(shop_id=shop, environment=env, connection_version=gen)
        if db is None:
            assert isinstance(job, Job)
            _jobs[(shop, env)] = job
        else:
            db.add(job)
    job.connection_version, job.lease_id = gen, lease
    job.lease_until, job.attempted_at, job.failed = now + dt.timedelta(minutes=30), now, False
    if db is not None:
        await db.commit()
    return lease, gen


async def finish(db: AsyncSession | None, shop: str, env: Environment,
                 lease: str, gen: int, tree: store.Tree | None) -> None:
    if db is not None:
        await db.scalar(select(ShopTable.id).where(ShopTable.id == shop).with_for_update())
    job = _jobs.get((shop, env)) if db is None else await db.get(CatalogSyncTable, (shop, env), populate_existing=True)
    if job is None or job.lease_id != lease:
        if db is not None:
            await db.commit()
        return
    now = get_utc_now()
    valid = job.lease_until is not None and now < job.lease_until and await connections.generation(db, shop, env) == gen
    if tree is not None and valid:
        saved = store.Snapshot(str(uuid4()), shop, env, gen, now, lists=tree)
        if db is None:
            for previous in list(store._snapshots.values()):
                if previous.shop == shop and previous.env == env and previous.retired_at is None:
                    previous.retired_at = now
                if previous.shop == shop and previous.env == env and previous.retired_at and previous.retired_at <= now - dt.timedelta(hours=48):
                    del store._snapshots[previous.id]
            store._snapshots[saved.id] = saved
        else:
            await db.execute(update(CatalogSnapshotTable).where(CatalogSnapshotTable.shop_id == shop,
                CatalogSnapshotTable.environment == env, CatalogSnapshotTable.retired_at.is_(None)).values(retired_at=now))
            await db.execute(delete(CatalogSnapshotTable).where(CatalogSnapshotTable.shop_id == shop,
                CatalogSnapshotTable.environment == env, CatalogSnapshotTable.retired_at <= now - dt.timedelta(hours=48)))
            db.add(CatalogSnapshotTable(id=saved.id, shop_id=shop, environment=env, connection_version=gen, created_at=now))
            await db.flush()
            db.add_all([CatalogListTable(snapshot_id=saved.id, level=level, parent_id=parent,
                choices_json=json.dumps([c.model_dump() for c in items])) for (level, parent), items in tree.items()])
    job.lease_id, job.lease_until, job.failed = None, None, tree is None or not valid
    if db is not None:
        await db.commit()
