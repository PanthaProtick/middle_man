"""Snapshot reads never perform provider I/O; list rows avoid loading a national tree."""
import datetime as dt
import json
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import get_utc_now
from app.models.pathao import Environment
from app.models.pathao_location import LocationChoice
from app.models.pathao_snapshot import CatalogListTable, CatalogSnapshotTable
from app.services import pathao_connections as connections
from app.services.pathao_catalog import Level, member
from app.services.seller_service import SellerDomainException

Tree = dict[tuple[Level, int], list[LocationChoice]]


@dataclass
class Snapshot:
    id: str
    shop: str
    env: Environment
    generation: int
    created_at: dt.datetime
    retired_at: dt.datetime | None = None
    lists: Tree = field(default_factory=dict)


_snapshots: dict[str, Snapshot] = {}


class CatalogExpired(SellerDomainException):
    pass


def expired() -> CatalogExpired:
    return CatalogExpired(422, 'PATHAO_CATALOG_EXPIRED',
        'Location choices changed. Retry location lookup and recheck your selections.', fields=[{
            'field': 'address.pathao.city_id', 'code': 'pathao_catalog_expired',
            'message': 'Retry location lookup and recheck your selections.',
        }])


async def snapshot(db: AsyncSession | None, shop: str, env: Environment,
                   version: str | None = None) -> Snapshot | None:
    gen = await connections.generation(db, shop, env)
    if db is None:
        found = next((s for s in _snapshots.values() if s.shop == shop and s.env == env
                      and s.generation == gen and (s.id == version if version else s.retired_at is None)), None)
    else:
        stmt = select(CatalogSnapshotTable).where(
            CatalogSnapshotTable.shop_id == shop, CatalogSnapshotTable.environment == env,
            CatalogSnapshotTable.connection_version == gen)
        stmt = stmt.where(CatalogSnapshotTable.id == version) if version else stmt.where(CatalogSnapshotTable.retired_at.is_(None))
        row = await db.scalar(stmt)
        found = Snapshot(row.id, shop, env, gen, row.created_at, row.retired_at) if row else None
        await db.commit()
    if version and (found is None or (found.retired_at is not None and
                                      get_utc_now() >= found.retired_at + dt.timedelta(hours=48))):
        raise expired()
    return found


async def choices(db: AsyncSession | None, saved: Snapshot, level: Level, parent: int = 0) -> list[LocationChoice]:
    if db is None:
        return saved.lists[(level, parent)]
    data = await db.scalar(select(CatalogListTable.choices_json).where(
        CatalogListTable.snapshot_id == saved.id, CatalogListTable.level == level, CatalogListTable.parent_id == parent))
    await db.commit()
    if data is None:
        raise expired()
    return [LocationChoice.model_validate(item) for item in json.loads(data)]


async def hierarchy(db: AsyncSession | None, saved: Snapshot, city: int | None = None,
                    zone: int | None = None) -> list[LocationChoice]:
    items = await choices(db, saved, 'city')
    if city is not None:
        member(items, city, 'city')
        items = await choices(db, saved, 'zone', city)
    if zone is not None:
        member(items, zone, 'zone')
        items = await choices(db, saved, 'area', zone)
    return items
