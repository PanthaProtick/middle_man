from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.courier import CourierDraft
from app.services.courier_drafts import get_draft
from app.services.seller_service import NotFoundError, SellerService

router = APIRouter(prefix='/seller/orders', tags=['seller-courier'])


@router.get('/{order_id}/courier-draft', response_model=CourierDraft)
async def courier_draft(order_id: str, response: Response,
                        seller: SellerIdentity = Depends(get_seller_identity),
                        db: AsyncSession | None = Depends(get_db)) -> CourierDraft:
    response.headers['Cache-Control'] = 'no-store, private'
    response.headers['Referrer-Policy'] = 'no-referrer'
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError('Order not found')
    return await get_draft(db, shop.id, order_id)
