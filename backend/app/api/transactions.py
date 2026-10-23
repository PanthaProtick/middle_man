from typing import Optional

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.transaction import (
    ManualReceipt,
    ReceiptListResponse,
    ReceiptView,
)
from app.services.seller_service import NotFoundError, SellerService
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/seller/transactions", tags=["seller-transactions"])


def _set_security_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Referrer-Policy"] = "no-referrer"


@router.post("", response_model=ReceiptView, summary="Record a received payment manually")
async def record_manual_transaction(
    payload: ManualReceipt,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ReceiptView:
    _set_security_headers(response)
    seller_svc = SellerService(db)
    shop = await seller_svc.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Shop must be created before recording transactions")

    tx_svc = TransactionService(db)
    receipt, status_code = await tx_svc.record_manual_transaction(
        shop_id=shop.id,
        actor_id=seller.owner_id,
        payload=payload,
        idempotency_key=idempotency_key,
    )
    response.status_code = status_code
    return receipt


@router.get("", response_model=ReceiptListResponse, summary="List same-shop received transactions")
async def list_transactions(
    response: Response,
    cursor: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    review: Optional[str] = Query(None),
    used: Optional[str] = Query(None),
    parse: Optional[str] = Query(None),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ReceiptListResponse:
    _set_security_headers(response)
    seller_svc = SellerService(db)
    shop = await seller_svc.get_shop_by_owner(seller.owner_id)
    if not shop:
        return ReceiptListResponse(items=[], next_cursor=None)

    tx_svc = TransactionService(db)
    items, next_cursor = await tx_svc.list_transactions(
        shop_id=shop.id,
        cursor=cursor,
        limit=limit,
        review_filter=review,
        used_filter=used,
        parse_filter=parse,
    )
    return ReceiptListResponse(items=items, next_cursor=next_cursor)
