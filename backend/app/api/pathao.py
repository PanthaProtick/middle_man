"""Seller-only courier settings; no public or booking operations."""
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.pathao import ConnectInput, ConnectionView, DefaultsInput, Environment, StoreChoices
from app.models.pathao_snapshot import CatalogStatus
from app.services import pathao_connections as connections
from app.services import pathao_snapshot_jobs, pathao_snapshot_sync
from app.services.seller_service import NotFoundError, SellerService

router = APIRouter(prefix='/seller/courier/pathao', tags=['seller-courier-settings'])


async def shop_scope(response: Response, seller: SellerIdentity = Depends(get_seller_identity),
                     db: AsyncSession | None = Depends(get_db)) -> str:
    response.headers['Cache-Control'] = 'no-store, private'
    response.headers['Referrer-Policy'] = 'no-referrer'
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError('Shop not found')
    if db is not None:
        await db.commit()
    return shop.id


@router.get('/{environment}', response_model=ConnectionView)
async def read(environment: Environment, shop: str = Depends(shop_scope),
               db: AsyncSession | None = Depends(get_db)) -> ConnectionView:
    return connections.view(environment, await connections.latest(db, shop, environment))


@router.put('/{environment}', response_model=ConnectionView)
async def connect(environment: Environment, data: ConnectInput, background: BackgroundTasks, shop: str = Depends(shop_scope),
                  db: AsyncSession | None = Depends(get_db)) -> ConnectionView:
    result = await connections.connect(db, shop, environment, data)
    background.add_task(pathao_snapshot_sync.run_one, shop, environment, True, db.bind if db else None)
    return result


@router.get('/{environment}/stores', response_model=StoreChoices)
async def stores(environment: Environment, expected_version: int = Query(ge=1), shop: str = Depends(shop_scope),
                 db: AsyncSession | None = Depends(get_db)) -> StoreChoices:
    return await connections.choices(db, shop, environment, expected_version)


@router.patch('/{environment}', response_model=ConnectionView)
async def defaults(environment: Environment, data: DefaultsInput, shop: str = Depends(shop_scope),
                   db: AsyncSession | None = Depends(get_db)) -> ConnectionView:
    return await connections.defaults(db, shop, environment, data)


@router.get('/{environment}/catalog', response_model=CatalogStatus)
async def catalog_status(environment: Environment, shop: str = Depends(shop_scope),
                         db: AsyncSession | None = Depends(get_db)) -> CatalogStatus:
    return await pathao_snapshot_jobs.status(db, shop, environment)


@router.delete('/{environment}', response_model=ConnectionView)
async def disconnect(environment: Environment, expected_version: int = Query(ge=1), shop: str = Depends(shop_scope),
                     db: AsyncSession | None = Depends(get_db)) -> ConnectionView:
    return await connections.disconnect(db, shop, environment, expected_version)


@router.post('/{environment}/catalog/refresh', response_model=CatalogStatus, status_code=202)
async def refresh_catalog(environment: Environment, background: BackgroundTasks, shop: str = Depends(shop_scope),
                          db: AsyncSession | None = Depends(get_db)) -> CatalogStatus:
    background.add_task(pathao_snapshot_sync.run_one, shop, environment, True, db.bind if db else None)
    return await pathao_snapshot_jobs.status(db, shop, environment)
