import datetime
from collections.abc import Callable
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.public_gate import verify_public_access_gate
from app.core.tokens import get_utc_now
from app.models.buyer import BuyerSubmission, PublicOrder
from app.models.pathao_location import LocationCatalog
from app.services.buyer_service import BuyerService

router = APIRouter(prefix="/public/orders", tags=["public-orders"])


def get_buyer_clock() -> Callable[[], datetime.datetime]:
    return get_utc_now


@router.get('/{portal_token}/pathao-locations', response_model=LocationCatalog)
async def pathao_locations(
    portal_token: str,
    city_id: int | None = Query(None, gt=0),
    zone_id: int | None = Query(None, gt=0),
    catalog_version: str | None = Query(None, pattern=r'^[a-f0-9-]{36}$'),
    clock: Callable[[], datetime.datetime] = Depends(get_buyer_clock),
    is_gate_approved: bool = Depends(verify_public_access_gate),
    db: Optional[AsyncSession] = Depends(get_db),
) -> LocationCatalog:
    from app.services.pathao_catalog import invalid
    from app.services.pathao_locations import catalog, link_shop
    await link_shop(db, portal_token, clock)
    if zone_id is not None and city_id is None:
        raise invalid('city')
    # Legacy forms may still send catalog_version; on-demand lists no longer trust it.
    result = await catalog(db, portal_token, city_id, zone_id)
    await link_shop(db, portal_token, clock)
    return result


@router.get("/{portal_token}", response_model=PublicOrder)
async def get_public_order(
    portal_token: str,
    request: Request,
    clock: Callable[[], datetime.datetime] = Depends(get_buyer_clock),
    is_gate_approved: bool = Depends(verify_public_access_gate),
    db: Optional[AsyncSession] = Depends(get_db),
) -> PublicOrder:
    try:
        agent = request.headers.get("user-agent", "").lower()
        return await BuyerService(db, clock).get_public_order(portal_token, is_bot=any(word in agent for word in ("bot", "crawler", "spider", "preview")))
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise HTTPException(503, detail={"code": "DATABASE_UNAVAILABLE", "message": "Unable to load order. Please retry."}) from None


@router.post("/{portal_token}/submission", response_model=PublicOrder)
async def submit_buyer_details(
    portal_token: str,
    payload: BuyerSubmission,
    response: Response,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=64),
    clock: Callable[[], datetime.datetime] = Depends(get_buyer_clock),
    is_gate_approved: bool = Depends(verify_public_access_gate),
    db: Optional[AsyncSession] = Depends(get_db),
) -> PublicOrder:
    try:
        order, status_code = await BuyerService(db, clock).submit_buyer_details(portal_token, payload, idempotency_key)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise HTTPException(503, detail={"code": "DATABASE_UNAVAILABLE", "message": "Submission outcome unknown. Retry the same details and key, then refresh status."}) from None
    response.status_code = status_code
    return order
