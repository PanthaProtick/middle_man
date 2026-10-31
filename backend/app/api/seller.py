from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.core.tokens import get_utc_now
from app.models.cleanup import RetentionCleanupResponse, RetentionStatusResponse
from app.models.seller import (
    AccountInput,
    AccountUpdateInput,
    PaymentAccountResponse,
    ShopInput,
    ShopStatusResponse,
)
from app.models.shop_metrics import TodayShopMetrics
from app.models.unseen_entries import UnseenEntryCounts, UnseenEntryQuery
from app.services.raw_evidence_cleanup import get_retention_status, purge_raw_evidence
from app.services.seller_service import NotFoundError, SellerService
from app.services.shop_metrics import today_shop_metrics
from app.services.unseen_entries import unseen_entry_counts

router = APIRouter(prefix="/seller", tags=["seller"])


@router.get("/unseen-entries", response_model=UnseenEntryCounts)
async def get_unseen_entries(
    query: Annotated[UnseenEntryQuery, Query()],
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> UnseenEntryCounts:
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError("Shop not found")
    return await unseen_entry_counts(db, shop.id, query, get_utc_now())


@router.get("/metrics/today", response_model=TodayShopMetrics)
async def get_today_metrics(
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> TodayShopMetrics:
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if shop is None:
        raise NotFoundError("Shop not found")
    return await today_shop_metrics(db, shop.id, get_utc_now())


@router.get("/shop", response_model=ShopStatusResponse, summary="Get current seller shop")
async def get_shop(
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ShopStatusResponse:
    service = SellerService(db)
    shop = await service.get_shop_by_owner(seller.owner_id)
    return ShopStatusResponse(shop=shop, setup_needed=(shop is None))


@router.post("/shop", response_model=ShopStatusResponse, summary="Create seller shop")
async def create_shop(
    payload: ShopInput,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ShopStatusResponse:
    service = SellerService(db)
    shop, status_code = await service.create_shop(seller.owner_id, payload, idempotency_key)
    response.status_code = status_code
    return ShopStatusResponse(shop=shop, setup_needed=False)


@router.get(
    "/payment-accounts",
    response_model=List[PaymentAccountResponse],
    summary="List shop payment accounts",
)
async def list_payment_accounts(
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> List[PaymentAccountResponse]:
    service = SellerService(db)
    shop = await service.get_shop_by_owner(seller.owner_id)
    if not shop:
        return []
    return await service.list_payment_accounts(shop.id)


@router.post(
    "/payment-accounts",
    response_model=PaymentAccountResponse,
    summary="Create payment account",
)
async def create_payment_account(
    payload: AccountInput,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> PaymentAccountResponse:
    service = SellerService(db)
    shop = await service.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Shop must be created before adding payment accounts")

    account, status_code = await service.create_payment_account(
        shop.id, seller.owner_id, payload, idempotency_key
    )
    response.status_code = status_code
    return account


@router.patch(
    "/payment-accounts/{account_id}",
    response_model=PaymentAccountResponse,
    summary="Update payment account metadata or active status",
)
async def update_payment_account(
    account_id: str,
    payload: AccountUpdateInput,
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> PaymentAccountResponse:
    service = SellerService(db)
    shop = await service.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Payment account not found")

    return await service.update_payment_account(shop.id, account_id, payload)


@router.get("/retention/status", response_model=RetentionStatusResponse, summary="Get evidence retention and overdue cleanup status")
async def get_seller_retention_status(
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> RetentionStatusResponse:
    service = SellerService(db)
    shop = await service.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Shop not found")
    now = get_utc_now()
    return await get_retention_status(db, now, shop.id)


@router.post("/retention/cleanup", response_model=RetentionCleanupResponse, summary="Run retryable raw evidence cleanup")
async def run_seller_retention_cleanup(
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> RetentionCleanupResponse:
    service = SellerService(db)
    shop = await service.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Shop not found")
    now = get_utc_now()
    return await purge_raw_evidence(db, now, shop.id)
