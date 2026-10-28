from typing import Optional

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.receipt_correction import ReceiptCorrection
from app.models.resolution import ReceiptComparison, ResolutionInput
from app.models.transaction import (
    ManualReceipt,
    ReceiptListResponse,
    ReceiptView,
)
from app.services.evidence_resolution import resolve_evidence
from app.services.receipt_comparison import compare_receipt
from app.services.receipt_correction import correct_receipt
from app.services.seller_service import NotFoundError, SellerDomainException, SellerService
from app.services.transaction_listing import list_shop_transactions
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/seller/transactions", tags=["seller-transactions"])


@router.patch("/{receipt_id}", response_model=ReceiptComparison)
async def correct_transaction(
    receipt_id: str, payload: ReceiptCorrection, response: Response,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=128),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ReceiptComparison:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError()
    try:
        return await correct_receipt(db, shop.id, seller.owner_id, receipt_id, payload, idempotency_key)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise SellerDomainException(503, "DATABASE_UNAVAILABLE", "Correction outcome unknown. Retry the same payload and key, then refresh.") from None


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
    search: Optional[str] = Query(None, max_length=200),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ReceiptListResponse:
    _set_security_headers(response)
    seller_svc = SellerService(db)
    shop = await seller_svc.get_shop_by_owner(seller.owner_id)
    if not shop:
        return ReceiptListResponse(items=[], next_cursor=None)

    items, next_cursor = await list_shop_transactions(
        db,
        shop_id=shop.id,
        cursor=cursor,
        limit=limit,
        review_filter=review,
        used_filter=used,
        parse_filter=parse,
        search=search,
    )
    return ReceiptListResponse(items=items, next_cursor=next_cursor)


@router.get("/{receipt_id}", response_model=ReceiptComparison)
async def inspect_receipt(
    receipt_id: str, response: Response,
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ReceiptComparison:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError()
    return await compare_receipt(db, shop.id, receipt_id)


@router.post("/{receipt_id}/resolve", response_model=ReceiptComparison)
async def resolve_receipt(
    receipt_id: str, payload: ResolutionInput, response: Response,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=128),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ReceiptComparison:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError()
    try:
        return await resolve_evidence(db, shop.id, seller.owner_id, receipt_id, payload, idempotency_key)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise SellerDomainException(503, "DATABASE_UNAVAILABLE", "Decision outcome unknown. Retry the same decision and key, then refresh.") from None
