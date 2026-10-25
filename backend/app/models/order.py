from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_SAFE_INTEGER = 9007199254740991  # 2^53 - 1


class OrderInput(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=200)
    total_minor: int = Field(..., gt=0)
    required_advance_minor: int = Field(..., gt=0)
    payment_account_id: str = Field(..., min_length=1, max_length=64)

    @field_validator("product_name")
    @classmethod
    def clean_product_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Product name cannot be blank")
        return s

    @field_validator("total_minor", "required_advance_minor")
    @classmethod
    def check_safe_integer(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Amount must be a positive integer minor unit")
        if v > MAX_SAFE_INTEGER:
            raise ValueError("Amount exceeds maximum safe integer value")
        return v

    @model_validator(mode="after")
    def validate_advance_not_exceeding_total(self) -> "OrderInput":
        if self.required_advance_minor > self.total_minor:
            raise ValueError("Required advance cannot exceed order total")
        return self


class SellerOrder(BaseModel):
    buyer_link_revoked_at: Optional[datetime] = None
    id: str
    shop_id: str
    payment_account_id: str
    product_name: str
    total_minor: int
    required_advance_minor: int
    expected_cod_minor: int
    actual_cod_minor: Optional[int] = None
    account_provider: str
    account_receiving_number: str
    account_label: str
    lifecycle: Literal["awaiting_buyer", "pending", "confirmed", "rejected", "cancelled", "expired"]
    version: int
    review_reasons: List[str] = Field(default_factory=list)
    buyer_revision: Optional[int] = None
    allocation_basis: Optional[str] = None
    portal_token: str
    portal_url: str
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    completed_at: Optional[datetime] = None
    predecessor_order_id: Optional[str] = None
    replaced_by_order_id: Optional[str] = None


class SellerOrderListResponse(BaseModel):
    items: List[SellerOrder]
    next_cursor: Optional[str] = None


class ResolveOrderLinkInput(BaseModel):
    portal_token: str = Field(..., min_length=1)

    @field_validator("portal_token")
    @classmethod
    def clean_token(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Portal token cannot be blank")
        return s


class ResolveOrderLinkResponse(BaseModel):
    order_id: str
