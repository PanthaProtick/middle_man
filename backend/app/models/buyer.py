from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.order import MAX_SAFE_INTEGER
from app.models.seller import canonicalize_bd_phone


def clean_trx_id(raw: str) -> str:
    cleaned = raw.strip()
    if not cleaned:
        raise ValueError("Transaction ID cannot be blank")
    if len(cleaned) > 128:
        raise ValueError("Transaction ID exceeds maximum limit of 128 characters")
    return cleaned


class Address(BaseModel):
    raw_text: str = Field(..., min_length=1, max_length=2000)
    district: Optional[str] = Field(None, max_length=100)
    thana: Optional[str] = Field(None, max_length=100)
    area: Optional[str] = Field(None, max_length=100)
    street_line: Optional[str] = Field(None, max_length=200)
    landmark: Optional[str] = Field(None, max_length=200)

    @field_validator("raw_text")
    @classmethod
    def clean_raw_text(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Address cannot be blank")
        return s


class PaymentClaim(BaseModel):
    provider: Literal["bkash", "nagad"]
    trx_id: str = Field(..., min_length=1, max_length=128)
    sender_number: str = Field(..., min_length=1, max_length=32)
    amount_minor: int = Field(..., gt=0)
    claimed_at: Optional[datetime] = None
    evidence_id: Optional[str] = Field(None, max_length=64)

    # Internal raw & canonical representations
    sender_number_raw: str = ""
    sender_number_canonical: str = ""

    @field_validator("trx_id")
    @classmethod
    def validate_trx_id(cls, v: str) -> str:
        return clean_trx_id(v)

    @field_validator("amount_minor")
    @classmethod
    def check_safe_amount(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Claimed amount must be a positive integer minor unit")
        if v > MAX_SAFE_INTEGER:
            raise ValueError("Claimed amount exceeds maximum safe integer value")
        return v

    @model_validator(mode="before")
    @classmethod
    def process_sender_numbers(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_sender = str(data.get("sender_number", "")).strip()
            data["sender_number_raw"] = raw_sender
            data["sender_number_canonical"] = canonicalize_bd_phone(raw_sender)
        return data


class BuyerSubmission(BaseModel):
    buyer_name: str = Field(..., min_length=1, max_length=200)
    contact_number: str = Field(..., min_length=1, max_length=32)
    address: Address
    payment_claim: PaymentClaim

    # Internal raw & canonical representations
    contact_number_raw: str = ""
    contact_number_canonical: str = ""

    @field_validator("buyer_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Buyer name cannot be blank")
        return s

    @model_validator(mode="before")
    @classmethod
    def process_contact_numbers(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_contact = str(data.get("contact_number", "")).strip()
            data["contact_number_raw"] = raw_contact
            data["contact_number_canonical"] = canonicalize_bd_phone(raw_contact)
        return data


class PublicOrder(BaseModel):
    id: str
    shop_display_name: str
    product_name: str
    total_minor: int
    required_advance_minor: int
    expected_cod_minor: int
    actual_cod_minor: Optional[int] = None
    account_provider: str
    account_receiving_number: str
    account_label: str
    lifecycle: Literal["awaiting_buyer", "pending", "confirmed", "rejected", "cancelled", "expired"]
    status_message: str
    submission_acknowledgement: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    completed_at: Optional[datetime] = None
