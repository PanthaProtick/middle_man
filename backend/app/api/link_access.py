from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.link_access import ReissueBuyerLink, RevokeBuyerLink
from app.models.order import SellerOrder
from app.services.link_access import change_buyer_link_access
from app.services.seller_service import NotFoundError, SellerDomainException, SellerService

router = APIRouter(prefix="/seller/orders", tags=["seller-orders"])


@router.post("/{order_id}/reissue-link", response_model=SellerOrder)
async def reissue_link(
    order_id: str, payload: ReissueBuyerLink, response: Response,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=64),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> SellerOrder:
    return await change_link(order_id, payload, response, idempotency_key, seller, db, reissue=True)


@router.post("/{order_id}/revoke-link", response_model=SellerOrder)
async def revoke_link(
    order_id: str, payload: RevokeBuyerLink, response: Response,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=64),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> SellerOrder:
    return await change_link(order_id, payload, response, idempotency_key, seller, db)


async def change_link(
    order_id: str, payload: RevokeBuyerLink, response: Response,
    idempotency_key: str, seller: SellerIdentity, db: AsyncSession | None,
    *, reissue: bool = False,
) -> SellerOrder:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Referrer-Policy"] = "no-referrer"
    try:
        shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
        if shop is None:
            raise NotFoundError("Order not found")
        return await change_buyer_link_access(db, shop.id, seller.owner_id, order_id, payload, idempotency_key, reissue=reissue)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise SellerDomainException(503, "DATABASE_UNAVAILABLE", "Outcome unknown. Retry the same payload and key, then refresh.") from None
