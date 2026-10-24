from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.order_export import ExportFilters, OrderSummary
from app.services.order_export import csv_document, summaries
from app.services.seller_service import NotFoundError, SellerDomainException, SellerService

router = APIRouter(prefix='/seller/orders', tags=['seller-orders'])


async def read_summaries(db: AsyncSession | None, seller: SellerIdentity, filters: ExportFilters,
                         order_id: str | None = None) -> list[OrderSummary]:
    try:
        shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
        if not shop:
            if order_id:
                raise NotFoundError('Order not found')
            return []
        return await summaries(db, shop.id, seller.owner_id, filters, order_id)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise SellerDomainException(503, 'EXPORT_UNAVAILABLE', 'Export unavailable. Please retry.') from None


@router.get('/export', response_class=Response)
async def export_orders(filters: Annotated[ExportFilters, Query()],
                        seller: SellerIdentity = Depends(get_seller_identity),
                        db: AsyncSession | None = Depends(get_db)) -> Response:
    items = await read_summaries(db, seller, filters)
    return Response(csv_document(items), media_type='text/csv; charset=utf-8', headers={
        'Content-Disposition': 'attachment; filename="order-summaries.csv"',
        'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff', 'X-Export-Count': str(len(items)),
    })


@router.get('/{order_id}/summary', response_model=OrderSummary)
async def order_summary(order_id: str, seller: SellerIdentity = Depends(get_seller_identity),
                        db: AsyncSession | None = Depends(get_db)) -> OrderSummary:
    return (await read_summaries(db, seller, ExportFilters(limit=500), order_id))[0]
