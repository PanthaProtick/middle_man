"""Authenticated explicit confirmation and recovery; no model authority."""
from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.order import OrderInput, SellerOrder
from app.models.order_submission import SubmissionContext, SubmissionResult
from app.services.order_service import OrderService
from app.services.order_submission import lookup_submission, storage_epoch, validate_submission_key
from app.services.seller_service import NotFoundError, SellerService

router = APIRouter(prefix='/seller/order-submissions', tags=['seller-orders'])


def secure(response: Response) -> None:
    response.headers['Cache-Control'] = 'no-store, private'
    response.headers['Referrer-Policy'] = 'no-referrer'


@router.get('', response_model=SubmissionContext)
async def context(response: Response, seller: SellerIdentity = Depends(get_seller_identity),
                  db: AsyncSession | None = Depends(get_db)) -> SubmissionContext:
    secure(response)
    if not await SellerService(db).get_shop_by_owner(seller.owner_id):
        raise NotFoundError('Shop not found')
    return SubmissionContext(storage_epoch=storage_epoch(db))


@router.get('/{key}', response_model=SubmissionResult)
async def lookup(response: Response, key: str = Path(min_length=1, max_length=64),
                 seller: SellerIdentity = Depends(get_seller_identity),
                 db: AsyncSession | None = Depends(get_db)) -> SubmissionResult:
    secure(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError('Shop not found')
    order = await lookup_submission(db, shop.id, seller.owner_id, key)
    return SubmissionResult(state='succeeded' if order else 'not_found', order=order)


@router.post('/{key}', response_model=SellerOrder, status_code=201)
async def submit(payload: OrderInput, response: Response,
                 key: str = Path(min_length=1, max_length=64),
                 seller: SellerIdentity = Depends(get_seller_identity),
                 db: AsyncSession | None = Depends(get_db)) -> SellerOrder:
    secure(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError('Shop not found')
    validate_submission_key(db, key)
    order, _ = await OrderService(db).create_order(shop.id, seller.owner_id, payload, key)
    return order
