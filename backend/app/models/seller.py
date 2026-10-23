import re
from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

BANGLA_DIGITS_MAP = {
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
}

BD_PHONE_REGEX = re.compile(r"^01[3-9]\d{8}$")


def canonicalize_bd_phone(raw: str) -> str:
    cleaned = raw.strip()
    for b_digit, a_digit in BANGLA_DIGITS_MAP.items():
        cleaned = cleaned.replace(b_digit, a_digit)
    # Remove separators: spaces, hyphens, parentheses
    cleaned = re.sub(r"[\s\-\(\)]", "", cleaned)
    if cleaned.startswith("+880"):
        cleaned = "0" + cleaned[4:]
    elif cleaned.startswith("880"):
        cleaned = "0" + cleaned[3:]
    elif cleaned.startswith("+88"):
        cleaned = cleaned[3:]

    if not BD_PHONE_REGEX.match(cleaned):
        raise ValueError(
            f"Invalid Bangladeshi phone number: '{raw}'. Must be 11 digits starting with 01[3-9]."
        )
    return cleaned


class ShopInput(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=200)

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Shop display name cannot be blank")
        return s


class ShopResponse(BaseModel):
    id: str
    owner_id: str
    display_name: str
    created_at: datetime
    updated_at: datetime


class ShopStatusResponse(BaseModel):
    shop: Optional[ShopResponse]
    setup_needed: bool


class AccountInput(BaseModel):
    provider: Literal["bkash", "nagad"]
    receiving_number: str
    label: str = Field(..., min_length=1, max_length=200)

    @field_validator("label")
    @classmethod
    def clean_label(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Account label cannot be blank")
        return s

    @field_validator("receiving_number")
    @classmethod
    def validate_number(cls, v: str) -> str:
        return canonicalize_bd_phone(v)


class AccountUpdateInput(BaseModel):
    expected_version: int = Field(..., ge=1)
    label: Optional[str] = Field(None, min_length=1, max_length=200)
    is_active: Optional[bool] = None

    @field_validator("label")
    @classmethod
    def clean_label(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("Account label cannot be blank")
        return s


class PaymentAccountResponse(BaseModel):
    id: str
    shop_id: str
    provider: str
    receiving_number: str
    label: str
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime


class ErrorFieldItem(BaseModel):
    field: Optional[str] = None
    code: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    fields: Optional[List[ErrorFieldItem]] = None


class StandardErrorResponse(BaseModel):
    error: ErrorBody
    detail: Optional[Any] = None
    request_id: str
