from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.sms import ImportList, ImportResult, SmsImportInput
from app.services.seller_service import NotFoundError, SellerService
from app.services.sms_import import SmsImportService

router = APIRouter(prefix='/seller/transactions', tags=['seller-sms'])


@router.post('/sms-import', response_model=ImportResult)
async def import_sms(
    payload: SmsImportInput, response: Response,
    idempotency_key: str = Header(alias='Idempotency-Key', min_length=1, max_length=128),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> ImportResult:
    response.headers['Cache-Control'] = 'no-store, private'
    response.headers['Referrer-Policy'] = 'no-referrer'
    if sum(len(text.encode('utf-8')) for text in payload.messages) > 65536:
        raise HTTPException(413, 'SMS batch exceeds 64 KiB')
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError('Shop must be created before importing SMS')
    shop_id = shop.id
    for attempt in range(3):
        try:
            return await SmsImportService(db).ingest(shop_id, seller.owner_id, payload, idempotency_key)
        except DBAPIError:
            if db is not None:
                await db.rollback()
            if attempt == 2:
                raise HTTPException(503, 'Import unavailable; retry with the same mutation key') from None
    raise AssertionError('Unreachable')


@router.get('/sms-imports', response_model=ImportList)
async def list_sms_imports(
    response: Response, cursor: str | None = Query(None, max_length=36),
    limit: int = Query(25, ge=1, le=100),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> ImportList:
    response.headers['Cache-Control'] = 'no-store, private'
    response.headers['Referrer-Policy'] = 'no-referrer'
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        return ImportList(items=[])
    return await SmsImportService(db).list_imports(shop.id, cursor, limit)
