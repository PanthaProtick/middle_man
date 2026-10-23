from typing import List, Optional

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.seller import (
    AccountInput,
    AccountUpdateInput,
    PaymentAccountResponse,
    ShopInput,
    ShopStatusResponse,
)
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
