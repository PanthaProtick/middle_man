from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.courier import CourierDraft, CourierDraftUpdate
from app.services.courier_drafts import get_draft, update_draft
from app.services.seller_service import NotFoundError, SellerDomainException, SellerService

router = APIRouter(prefix='/seller/orders', tags=['seller-courier'])


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
