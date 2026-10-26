"""Buyer-scoped catalog; no provider I/O while submission locks are held."""
import asyncio
import datetime
import hashlib
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.buyer import Address
from app.models.entities import OrderTable
from app.models.pathao import Environment
from app.models.pathao_location import LocationCatalog, LocationResolution, LocationSelection
from app.services.pathao_catalog import InvalidLocation, hierarchy, member
from app.services.pathao_connections import Revision, latest
from app.services.public_order_access import require_public_order_access
from app.services.seller_service import NotFoundError, SellerDomainException


async def link_shop(db: AsyncSession | None, token: str,
                    clock: Callable[[], datetime.datetime] | None = None) -> str:
    from app.services.buyer_service import _require_unsubmitted
    from app.services.order_service import _check_and_apply_expiry, _memory_orders, _memory_orders_by_digest
    digest = hashlib.sha256(token.strip().encode()).hexdigest()
    if db is None:
        row = _memory_orders.get(_memory_orders_by_digest.get(digest, ''))
        if row is None:
            raise NotFoundError('Order not found')
        require_public_order_access(row)
        if clock is not None:
            _check_and_apply_expiry(row, clock())
            _require_unsubmitted(str(row['lifecycle']))
        return str(row['shop_id'])
    statement = select(OrderTable).where(OrderTable.token_lookup_digest == digest).execution_options(populate_existing=True)
    order = await db.scalar(statement.with_for_update() if clock is not None else statement)
    if order is None:
        raise NotFoundError('Order not found')
    require_public_order_access(order)
    shop = order.shop_id
    lifecycle = order.lifecycle
    if clock is not None:
        _check_and_apply_expiry(order, clock())
        lifecycle = order.lifecycle
    # Submission rechecks lifecycle under lock, including replay and expiry.
    await db.commit()
    if clock is not None:
        _require_unsubmitted(lifecycle)
    return shop


async def catalog(db: AsyncSession | None, token: str, city: int | None = None,
                  zone: int | None = None) -> LocationCatalog:
    shop = await link_shop(db, token)
    env = settings.PATHAO_LOCATION_ENVIRONMENT
    revision = await latest(db, shop, env)
    result = LocationCatalog(condition='disconnected', environment=env, simulated=env == 'offline')
    if not revision.version:
        return result
    try:
        result.choices = await hierarchy(shop, env, revision, city, zone)
        result.condition = 'resolved'
    except SellerDomainException as error:
        if isinstance(error, InvalidLocation):
            raise
        result.condition = 'unavailable'
    await link_shop(db, token)  # Revocation/retention may have changed during I/O.
    if (await latest(db, shop, env)).version != revision.version:
        result.condition, result.choices = 'unavailable', []
    return result


async def submission_window_open(db: AsyncSession | None, token: str,
                                  clock: Callable[[], datetime.datetime]) -> bool:
    """Skip provider work for closed windows without splitting the aggregate write lock."""
    from app.services.order_service import _memory_orders, _memory_orders_by_digest
    digest = hashlib.sha256(token.strip().encode()).hexdigest()
    if db is None:
        raw = _memory_orders.get(_memory_orders_by_digest.get(digest, ''))
        return raw is not None and raw['lifecycle'] == 'awaiting_buyer' and clock() < raw['expires_at']
    row = (await db.execute(select(OrderTable.lifecycle, OrderTable.expires_at).where(
        OrderTable.token_lookup_digest == digest))).one_or_none()
    await db.commit()
    return row is not None and row.lifecycle == 'awaiting_buyer' and clock() < row.expires_at


async def resolve(db: AsyncSession | None, token: str, address: Address) -> Address:
    copy = address.model_copy(deep=True)
    selected = LocationSelection.model_validate(address.pathao.model_dump(include=set(LocationSelection.model_fields))) if address.pathao else LocationSelection()
    shop = await link_shop(db, token)
    env = settings.PATHAO_LOCATION_ENVIRONMENT
    revision = await latest(db, shop, env)
    resolution = LocationResolution(condition='disconnected', environment=env)
    if revision.version:
        try:
            # One shared hierarchy deadline stays below the buyer's submission timeout.
            async with asyncio.timeout(10):
                resolution = await resolve_choices(shop, env, revision, selected)
        except InvalidLocation:
            raise
        except (SellerDomainException, TimeoutError):
            resolution = LocationResolution(condition='unavailable', environment=env)
        await link_shop(db, token)
        if (await latest(db, shop, env)).version != revision.version:
            resolution = LocationResolution(condition='unavailable', environment=env)
    if selected.unsupported:
        resolution.condition = 'unsupported'
    copy.pathao = resolution
    return copy


async def resolve_choices(shop: str, env: Environment, revision: Revision,
                          selected: LocationSelection) -> LocationResolution:
    resolution = LocationResolution(condition='missing_choices', environment=env)
    if selected.city_id:
        city = member(await hierarchy(shop, env, revision), selected.city_id)
        zones = await hierarchy(shop, env, revision, city.id)
        resolution.city_id, resolution.city_name = city.id, city.name
        if selected.zone_id:
            zone = member(zones, selected.zone_id)
            areas = await hierarchy(shop, env, revision, city.id, zone.id)
            resolution.zone_id, resolution.zone_name = zone.id, zone.name
            if selected.area_id:
                area = member(areas, selected.area_id)
                resolution.area_id, resolution.area_name = area.id, area.name
                resolution.condition = 'resolved' if area.home_delivery_available is True else 'unsupported'
            elif not areas:
                # No source proves that an empty list authorizes omitting recipient_area.
                resolution.condition = 'no_area_unverified'
    elif not selected.unsupported:
        await hierarchy(shop, env, revision)
    return resolution
