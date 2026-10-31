"""Buyer-scoped on-demand location lookup; no provider I/O while submission locks are held."""
import datetime
import hashlib
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.buyer import Address
from app.models.entities import OrderTable
from app.models.pathao import Environment
from app.models.pathao_location import LocationCatalog, LocationChoice, LocationResolution, LocationSelection
from app.services import pathao_catalog
from app.services.pathao_catalog import InvalidLocation, Level, member, required
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
    if not revision.connected:
        return result
    validation_error: InvalidLocation | None = None
    try:
        result.choices = await pathao_catalog.hierarchy(shop, env, revision, city, zone)
        result.condition = 'resolved'
    except InvalidLocation as error:
        validation_error = error
    except SellerDomainException:
        result.condition = 'unavailable'
    await link_shop(db, token)  # Revocation/retention may have changed during I/O.
    if (await latest(db, shop, env)).version != revision.version:
        result.condition, result.choices = 'unavailable', []
    elif validation_error is not None:
        raise validation_error
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
    if revision.connected:
        validation_error: SellerDomainException | None = None
        try:
            resolution = await resolve_choices(shop, env, revision, selected, fresh=False)
        except InvalidLocation as error:
            validation_error = error
        except SellerDomainException:
            resolution = LocationResolution(condition='unavailable', environment=env)
        await link_shop(db, token)
        if (await latest(db, shop, env)).version != revision.version:
            resolution = LocationResolution(condition='unavailable', environment=env)
        elif validation_error is not None:
            raise validation_error
    resolution.unsupported = selected.unsupported
    if selected.unsupported:
        resolution.condition = 'unsupported'
    copy.pathao = resolution
    return copy


async def resolve_choices(shop: str, env: Environment, revision: Revision,
                          selected: LocationSelection, *, fresh: bool = True) -> LocationResolution:
    async def load(city: int | None = None, zone: int | None = None) -> list[LocationChoice]:
        # Seller review obtains current coverage; buyer submission may reuse a still-valid list.
        level: Level = 'area' if zone is not None else 'zone' if city is not None else 'city'
        return await pathao_catalog.choices(shop, env, revision, level, zone or city, fresh=fresh)

    resolution = LocationResolution(condition='missing_choices', environment=env, unsupported=selected.unsupported)
    if selected.unsupported and not (selected.city_id or selected.zone_id or selected.area_id):
        resolution.condition = 'unsupported'
        return resolution
    cities = await load()
    if not selected.city_id:
        if selected.unsupported:
            resolution.condition = 'unsupported'
        elif cities:
            raise required('city')
        return resolution
    if not cities:
        # An empty catalog cannot verify a saved ID; discard it rather than guess.
        return resolution
    city = member(cities, selected.city_id, 'city')
    resolution.city_id, resolution.city_name = city.id, city.name
    zones = await load(city.id)
    if not selected.zone_id:
        if selected.unsupported:
            resolution.condition = 'unsupported'
        elif zones:
            raise required('zone')
        return resolution
    if not zones:
        return resolution
    zone = member(zones, selected.zone_id, 'zone')
    resolution.zone_id, resolution.zone_name = zone.id, zone.name
    areas = await load(city.id, zone.id)
    if not selected.area_id:
        if selected.unsupported:
            resolution.condition = 'unsupported'
        elif not areas:
            resolution.condition = 'no_area_unverified'
        else:
            raise required('area')
        return resolution
    if not areas:
        resolution.condition = 'no_area_unverified'
        return resolution
    area = member(areas, selected.area_id, 'area')
    resolution.area_id, resolution.area_name = area.id, area.name
    resolution.condition = 'resolved' if area.home_delivery_available is True else 'unsupported'
    if selected.unsupported:
        resolution.condition = 'unsupported'
    return resolution
