"""Owning-seller status and retry; no caller-controlled clock or shop ID."""
from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.core.tokens import get_utc_now
from app.models.structured_retention import StructuredRetentionStatus
from app.services.seller_service import NotFoundError, SellerDomainException, SellerService
from app.services.structured_retention import purge_completed_orders, retention_status

router = APIRouter(prefix='/seller/retention/structured', tags=['retention'])


@router.get('', response_model=StructuredRetentionStatus)
async def status(seller: SellerIdentity = Depends(get_seller_identity),
                 db: AsyncSession | None = Depends(get_db)) -> StructuredRetentionStatus:
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError('Shop not found')
    try:
        return await retention_status(db, get_utc_now(), shop.id)
    except SQLAlchemyError:
        raise SellerDomainException(503, 'RETENTION_UNAVAILABLE', 'Retention status unavailable. Please retry.') from None


@router.post('/cleanup', response_model=StructuredRetentionStatus)
async def cleanup(seller: SellerIdentity = Depends(get_seller_identity),
                  db: AsyncSession | None = Depends(get_db)) -> StructuredRetentionStatus:
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError('Shop not found')
    try:
        return await purge_completed_orders(db, get_utc_now(), shop.id)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise SellerDomainException(503, 'RETENTION_UNAVAILABLE', 'Cleanup unavailable. Please retry.') from None
