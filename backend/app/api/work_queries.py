"""Seller work-query previews shared with dashboard list and export filters."""
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.work_query import PreparationQueryPreview
from app.services.delivery_preparation import (
    PREPARATION_QUERY,
    empty_preparation_preview,
    preparation_preview,
)
from app.services.delivery_staging import label_orders
from app.services.seller_service import SellerService

router = APIRouter(prefix="/seller/work-queries", tags=["seller-work-queries"])


@router.get("/preparation", response_model=PreparationQueryPreview)
async def read_preparation_preview(
    response: Response,
    cursor: Optional[str] = Query(None, max_length=36),
    limit: int = Query(10, ge=1, le=50),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> PreparationQueryPreview:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Referrer-Policy"] = "no-referrer"
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        return empty_preparation_preview()
    preview = await preparation_preview(db, shop.id, cursor=cursor, limit=limit)
    await label_orders(db, shop.id, [item.order for item in preview.items])
    return preview


__all__ = ["router", "PREPARATION_QUERY"]
