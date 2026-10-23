from typing import Optional

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.database import get_db
from app.models.correction import BuyerCorrection, BuyerHistory
from app.models.order import (
    OrderInput,
    ResolveOrderLinkInput,
    ResolveOrderLinkResponse,
    SellerOrder,
    SellerOrderListResponse,
)
from app.services.buyer_correction import correct, history
from app.services.order_service import OrderService
from app.services.seller_service import NotFoundError, SellerService

router = APIRouter(prefix="/seller", tags=["seller-orders"])


@router.patch('/orders/{order_id}/buyer-details', response_model=SellerOrder)
async def correct_buyer_details(
    order_id: str, payload: BuyerCorrection, response: Response,
    idempotency_key: str = Header(..., alias='Idempotency-Key', min_length=1, max_length=64),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> SellerOrder:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError('Order not found')
    return await correct(db, shop.id, seller.owner_id, order_id, payload, idempotency_key)


@router.get('/orders/{order_id}/history', response_model=BuyerHistory)
async def buyer_history(
    order_id: str, response: Response, cursor: Optional[str] = Query(None, max_length=36),
    limit: int = Query(25, ge=1, le=100),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> BuyerHistory:
    _set_security_headers(response)
    shop = await SellerService(db).get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError('Order not found')
    return await history(db, shop.id, order_id, cursor, limit)


def _set_security_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Referrer-Policy"] = "no-referrer"


@router.get("/orders", response_model=SellerOrderListResponse, summary="List same-shop orders")
async def list_orders(
    response: Response,
    cursor: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None),
    review: Optional[str] = Query(None),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> SellerOrderListResponse:
    _set_security_headers(response)
    seller_svc = SellerService(db)
    shop = await seller_svc.get_shop_by_owner(seller.owner_id)
    if not shop:
        return SellerOrderListResponse(items=[], next_cursor=None)

    order_svc = OrderService(db)
    items, next_cursor = await order_svc.list_orders(
        shop_id=shop.id, cursor=cursor, limit=limit, status_filter=status, review_filter=review
    )
    return SellerOrderListResponse(items=items, next_cursor=next_cursor)


@router.post("/orders", response_model=SellerOrder, summary="Create a new order and buyer link")
async def create_order(
    payload: OrderInput,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> SellerOrder:
    _set_security_headers(response)
    seller_svc = SellerService(db)
    shop = await seller_svc.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Shop must be created before creating orders")

    order_svc = OrderService(db)
    order, status_code = await order_svc.create_order(
        shop_id=shop.id, owner_id=seller.owner_id, input_data=payload, idempotency_key=idempotency_key
    )
    response.status_code = status_code
    return order


@router.get("/orders/{order_id}", response_model=SellerOrder, summary="Get same-shop order details")
async def get_order(
    order_id: str,
    response: Response,
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> SellerOrder:
    _set_security_headers(response)
    seller_svc = SellerService(db)
    shop = await seller_svc.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Order not found")

    order_svc = OrderService(db)
    return await order_svc.get_order(shop_id=shop.id, order_id=order_id)


@router.post("/order-links/resolve", response_model=ResolveOrderLinkResponse, summary="Resolve portal token to order ID")
async def resolve_order_link(
    payload: ResolveOrderLinkInput,
    response: Response,
    seller: SellerIdentity = Depends(get_seller_identity),
    db: Optional[AsyncSession] = Depends(get_db),
) -> ResolveOrderLinkResponse:
    _set_security_headers(response)
    seller_svc = SellerService(db)
    shop = await seller_svc.get_shop_by_owner(seller.owner_id)
    if not shop:
        raise NotFoundError("Order not found")

    order_svc = OrderService(db)
    order_id = await order_svc.resolve_portal_token(shop_id=shop.id, portal_token=payload.portal_token)
    return ResolveOrderLinkResponse(order_id=order_id)
