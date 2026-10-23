import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.public_gate import verify_public_access_gate
from app.models.buyer import BuyerSubmission, PublicOrder
from app.services.buyer_service import BuyerService

router = APIRouter(prefix="/public/orders", tags=["public-orders"])


def _set_public_security_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Referrer-Policy"] = "no-referrer"


def _parse_test_now(test_now: Optional[str]) -> Optional[datetime.datetime]:
    if test_now:
        try:
            return datetime.datetime.fromisoformat(test_now)
        except ValueError:
            pass
    return None


@router.get("/{portal_token}", response_model=PublicOrder, summary="Get public order details by portal token")
async def get_public_order(
    portal_token: str,
    response: Response,
    test_now: Optional[str] = Header(None, alias="X-Test-Now"),
    is_gate_approved: bool = Depends(verify_public_access_gate),
    db: Optional[AsyncSession] = Depends(get_db),
) -> PublicOrder:
    _set_public_security_headers(response)
    now = _parse_test_now(test_now)
    buyer_svc = BuyerService(db)
    return await buyer_svc.get_public_order(portal_token=portal_token, now=now)


@router.post("/{portal_token}/submission", response_model=PublicOrder, summary="Submit buyer details and payment claim")
async def submit_buyer_details(
    portal_token: str,
    payload: BuyerSubmission,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    test_now: Optional[str] = Header(None, alias="X-Test-Now"),
    is_gate_approved: bool = Depends(verify_public_access_gate),
    db: Optional[AsyncSession] = Depends(get_db),
) -> PublicOrder:
    _set_public_security_headers(response)
    now = _parse_test_now(test_now)
    buyer_svc = BuyerService(db)
    order, status_code = await buyer_svc.submit_buyer_details(
        portal_token=portal_token,
        submission=payload,
        idempotency_key=idempotency_key,
        now=now,
    )
    response.status_code = status_code
    return order
