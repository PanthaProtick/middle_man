import datetime
from collections.abc import Callable
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.public_gate import verify_public_access_gate
from app.core.tokens import get_utc_now
from app.models.address_assistance import AddressExtractionRequest, AddressExtractionResponse
from app.models.buyer import BuyerSubmission, EvidenceUploadResponse, PublicOrder
from app.models.payment_extraction import PaymentExtractionRequest, PaymentExtractionResponse
from app.services.address_assistance import AddressAssistance
from app.services.address_provider import AddressProvider, get_address_provider
from app.services.buyer_service import BuyerService
from app.services.evidence_service import EvidenceService
from app.services.payment_extraction import PaymentExtraction
from app.services.payment_provider import PaymentProvider, get_payment_provider

router = APIRouter(prefix="/public/orders", tags=["public-orders"])


def get_buyer_clock() -> Callable[[], datetime.datetime]:
    return get_utc_now


@router.post("/{portal_token}/payment-extraction", response_model=PaymentExtractionResponse)
async def extract_buyer_payment(
    portal_token: str,
    payload: PaymentExtractionRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=64),
    clock: Callable[[], datetime.datetime] = Depends(get_buyer_clock),
    is_gate_approved: bool = Depends(verify_public_access_gate),
    db: Optional[AsyncSession] = Depends(get_db),
    provider: PaymentProvider = Depends(get_payment_provider),
) -> PaymentExtractionResponse:
    try:
        return await PaymentExtraction(db, provider, clock).extract(portal_token, payload, idempotency_key)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise HTTPException(503, detail={"code": "DATABASE_UNAVAILABLE", "message": "Outcome unknown. Retry the same evidence and key, or enter payment details manually."}) from None


@router.post("/{portal_token}/address-extraction", response_model=AddressExtractionResponse)
async def extract_buyer_address(
    portal_token: str,
    payload: AddressExtractionRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=64),
    clock: Callable[[], datetime.datetime] = Depends(get_buyer_clock),
    is_gate_approved: bool = Depends(verify_public_access_gate),
    db: Optional[AsyncSession] = Depends(get_db),
    provider: AddressProvider = Depends(get_address_provider),
) -> AddressExtractionResponse:
    try:
        return await AddressAssistance(db, provider, clock).extract(portal_token, payload, idempotency_key)
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise HTTPException(503, detail={"code": "DATABASE_UNAVAILABLE", "message": "Outcome unknown. Retry the same address and key, or enter the address manually."}) from None


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


def _extract_image_bytes(body: bytes, content_type: str) -> bytes:
    if "multipart/form-data" in content_type:
        boundary_idx = content_type.find("boundary=")
        if boundary_idx != -1:
            boundary_str = content_type[boundary_idx + 9:].split(";")[0].strip('"').strip()
            delimiter = f"--{boundary_str}".encode("latin1")
            parts = body.split(delimiter)
            for part in parts:
                if b"Content-Disposition" in part:
                    header_end = part.find(b"\r\n\r\n")
                    if header_end != -1:
                        data = part[header_end + 4:]
                        if data.endswith(b"\r\n"):
                            data = data[:-2]
                        if data.endswith(b"--"):
                            data = data[:-2]
                        return data
    return body


@router.post("/{portal_token}/evidence", response_model=EvidenceUploadResponse, status_code=201)
async def upload_buyer_evidence(
    portal_token: str,
    request: Request,
    response: Response,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=64),
    clock: Callable[[], datetime.datetime] = Depends(get_buyer_clock),
    is_gate_approved: bool = Depends(verify_public_access_gate),
    db: Optional[AsyncSession] = Depends(get_db),
) -> EvidenceUploadResponse:
    content_type = request.headers.get("content-type", "").lower()
    if content_type and not (
        content_type.startswith("image/jpeg")
        or content_type.startswith("image/png")
        or content_type.startswith("multipart/form-data")
        or content_type.startswith("application/octet-stream")
    ):
        raise HTTPException(
            422,
            detail={"code": "INVALID_IMAGE_CONTENT", "message": "Only JPEG and PNG formats are supported"},
        )
    body = await request.body()
    raw_bytes = _extract_image_bytes(body, content_type)
    try:
        evidence, status_code = await EvidenceService(db, clock).stage_buyer_evidence(
            portal_token, raw_bytes, idempotency_key
        )
    except SQLAlchemyError:
        if db is not None:
            await db.rollback()
        raise HTTPException(
            503,
            detail={"code": "DATABASE_UNAVAILABLE", "message": "Storage or database failure. Retry with the same key."},
        ) from None
    response.status_code = status_code
    return evidence
