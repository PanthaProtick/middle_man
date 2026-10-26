from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.courier import CourierDraft, CourierDraftUpdate
from app.models.courier_review import CourierReview, ReviewUpdate, ReviewVersion
from app.models.courier_submission import CourierSubmissionInput
from app.models.pathao import Environment
from app.models.pathao_location import LocationCatalog
from app.services import courier_attempts, courier_review, pathao_connections
from app.services.courier_drafts import get_draft, update_draft
from app.services.pathao_catalog import hierarchy
from app.services.seller_service import NotFoundError, SellerDomainException, SellerService

router = APIRouter(prefix='/seller/orders', tags=['seller-courier'])


async def review_scope(order_id: str, response: Response,
                       seller: SellerIdentity = Depends(get_seller_identity),
                       db: AsyncSession | None = Depends(get_db)) -> str:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError('Order not found')
    await get_draft(db, shop.id, order_id)
    if db is not None:
        await db.commit()
    return shop.id


@router.get('/{order_id}/courier-review', response_model=CourierReview)
async def read_review(order_id: str, shop: str = Depends(review_scope),
                      db: AsyncSession | None = Depends(get_db)) -> CourierReview:
    return await courier_review.read(db, shop, order_id)


@router.put('/{order_id}/courier-review', response_model=CourierReview)
async def update_review(order_id: str, payload: ReviewUpdate, shop: str = Depends(review_scope),
                        db: AsyncSession | None = Depends(get_db)) -> CourierReview:
    return await courier_review.update(db, shop, order_id, payload)


@router.post('/{order_id}/courier-review', response_model=CourierReview)
async def approve_review(order_id: str, payload: ReviewVersion, shop: str = Depends(review_scope),
                         db: AsyncSession | None = Depends(get_db)) -> CourierReview:
    return await courier_review.approve(db, shop, order_id, payload.expected_token)


@router.post('/{order_id}/courier-submission', response_model=CourierReview)
async def submit_courier(
    order_id: str,
    payload: CourierSubmissionInput,
    response: Response,
    idempotency_key: str = Header(..., alias='Idempotency-Key', min_length=1, max_length=64),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> CourierReview:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError('Order not found')
    return await courier_attempts.execute_submission(
        db, shop.id, seller.owner_id, order_id, payload.expected_token, idempotency_key,
    )


@router.get('/{order_id}/courier-review/locations', response_model=LocationCatalog)
async def review_locations(order_id: str, environment: Environment,
                           expected_version: int = Query(ge=1), city_id: int | None = Query(None, gt=0),
                           zone_id: int | None = Query(None, gt=0), shop: str = Depends(review_scope),
                           db: AsyncSession | None = Depends(get_db)) -> LocationCatalog:
    revision = await pathao_connections.latest(db, shop, environment)
    pathao_connections.check_version(revision, expected_version)
    choices = await hierarchy(shop, environment, revision, city_id, zone_id)
    pathao_connections.check_version(await pathao_connections.latest(db, shop, environment), expected_version)
    await get_draft(db, shop, order_id)
    return LocationCatalog(condition='resolved', environment=environment,
                           simulated=environment == 'offline', choices=choices)


def _set_security_headers(response: Response) -> None:
    response.headers['Cache-Control'] = 'no-store, private'
    response.headers['Referrer-Policy'] = 'no-referrer'


@router.get('/{order_id}/courier-draft', response_model=CourierDraft)
async def courier_draft(order_id: str, response: Response,
                        seller: SellerIdentity = Depends(get_seller_identity),
                        db: AsyncSession | None = Depends(get_db)) -> CourierDraft:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError('Order not found')
    return await get_draft(db, shop.id, order_id)


@router.patch('/{order_id}/courier-draft', response_model=CourierDraft)
async def edit_courier_draft(
    order_id: str,
    payload: CourierDraftUpdate,
    response: Response,
    idempotency_key: str = Header(..., alias='Idempotency-Key', min_length=1, max_length=64),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> CourierDraft:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError('Order not found')
    try:
        return await update_draft(db, shop.id, seller.owner_id, order_id, payload, idempotency_key)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise SellerDomainException(
            503, 'DATABASE_UNAVAILABLE',
            'Parcel update outcome unknown. Retry the same payload and key, then refresh.',
        ) from None
