from typing import Optional

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.review_assistance import ReviewAssistanceRequest, ReviewAssistanceResponse
from app.services.review_assistance import get_review_assistance
from app.services.review_generation import generate_review
from app.services.seller_service import NotFoundError, SellerDomainException, SellerService

router = APIRouter(prefix="/seller", tags=["review-assistance"])


def _set_security_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Referrer-Policy"] = "no-referrer"


@router.post(
    "/orders/{order_id}/review-assistance",
    response_model=ReviewAssistanceResponse,
    summary="Get localized advisory review assistance for a pending order",
)
async def review_assistance(
    order_id: str,
    payload: ReviewAssistanceRequest,
    response: Response,
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ReviewAssistanceResponse:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Order not found")

    local = await get_review_assistance(
        db=db,
        shop_id=shop.id,
        order_id=order_id,
        language=payload.language,
        receipt_id=payload.receipt_id,
    )
    if not payload.generate:
        return local
    # End the read transaction before the provider wait; no database locks span it.
    if db is not None:
        await db.rollback()
    result = await generate_review(local, shop.id)
    current_shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not current_shop or current_shop.id != shop.id:
        raise NotFoundError("Order not found")
    current = await get_review_assistance(db, shop.id, order_id, payload.language, payload.receipt_id)
    if current.context_token != local.context_token:
        raise SellerDomainException(409, "REVIEW_CHANGED", "Review changed. Refresh the order.")
    return result
