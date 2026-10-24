from typing import List, Optional

from fastapi import APIRouter, Depends, Header, Response
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
from app.services.evidence_service import EvidenceService
from app.services.raw_evidence_cleanup import get_retention_status, purge_raw_evidence
from app.services.seller_service import NotFoundError, SellerService

router = APIRouter(prefix="/seller", tags=["seller"])


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


@router.get("/evidence/{evidence_id}", summary="Download/view short-lived private evidence")
async def get_seller_evidence(
    evidence_id: str,
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> Response:
    service = SellerService(db)
    shop = await service.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Evidence not found")

    data, media_type = await EvidenceService(db).get_seller_evidence(shop.id, evidence_id)
    ext = "png" if media_type == "image/png" else "jpg"
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Cache-Control": "private, no-store, max-age=0",
            "Content-Disposition": f'inline; filename="evidence_{evidence_id}.{ext}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


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
