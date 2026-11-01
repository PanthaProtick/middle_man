"""Authenticated explicit payment confirmation and recovery; no model authority."""
from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.transaction import ManualReceipt
from app.models.transaction_submission import (
    RecordedTransactionResult,
    TransactionSubmissionContext,
    TransactionSubmissionLookup,
)
from app.services.order_submission import storage_epoch
from app.services.seller_service import NotFoundError, SellerDomainException, SellerService
from app.services.transaction_submission import (
    lookup_transaction_submission,
    record_transaction_submission,
)

router = APIRouter(prefix="/seller/transaction-submissions", tags=["seller-transactions"])


def _secure(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Referrer-Policy"] = "no-referrer"


@router.get("", response_model=TransactionSubmissionContext)
async def context(
    response: Response,
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> TransactionSubmissionContext:
    _secure(response)
    if not await SellerService(db).get_shop_by_owner(seller.owner_id):
        raise NotFoundError("Shop not found")
    return TransactionSubmissionContext(storage_epoch=storage_epoch(db))


@router.get("/{key}", response_model=TransactionSubmissionLookup)
async def lookup(
    response: Response,
    key: str = Path(min_length=1, max_length=64),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> TransactionSubmissionLookup:
    _secure(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Shop not found")
    return await lookup_transaction_submission(db, shop.id, seller.owner_id, key)


@router.post("/{key}", response_model=RecordedTransactionResult, status_code=201)
async def submit(
    payload: ManualReceipt,
    response: Response,
    key: str = Path(min_length=1, max_length=64),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: AsyncSession | None = Depends(get_db),
) -> RecordedTransactionResult:
    _secure(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Shop not found")
    try:
        result, status_code = await record_transaction_submission(
            db, shop.id, seller.owner_id, payload, key
        )
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise SellerDomainException(
            503, "DATABASE_UNAVAILABLE",
            "Payment recording outcome unknown. Check the same request, then retry.",
        ) from None
    response.status_code = status_code
    return result
