import datetime
from collections.abc import Callable
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.public_gate import verify_public_access_gate
from app.core.tokens import get_utc_now
from app.models.buyer import BuyerSubmission, PublicOrder
from app.services.buyer_service import BuyerService

router = APIRouter(prefix="/public/orders", tags=["public-orders"])


def get_buyer_clock() -> Callable[[], datetime.datetime]:
    return get_utc_now


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
