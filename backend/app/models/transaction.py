import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.seller import canonicalize_bd_phone

ParseState = Literal["valid", "incomplete"]
ConflictState = Literal["none", "identical", "conflicting"]
ReconciliationState = Literal["unmatched", "conflicted", "used"]


class ManualReceipt(BaseModel):
    payment_account_id: str = Field(..., min_length=1, max_length=36)
    provider: Literal["bkash", "nagad"]
    trx_id: str = Field(..., min_length=1, max_length=128)
    amount_minor: int = Field(..., gt=0, le=100_000_000_000)
    sender_number: Optional[str] = Field(None, max_length=32)
    occurred_at: Optional[datetime.datetime] = None

    @field_validator("trx_id")
    @classmethod
    def validate_trx_id(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Transaction ID cannot be blank")
        return s

    @field_validator("sender_number")
    @classmethod
    def validate_sender_number(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        if not s:
            return None
        canonicalize_bd_phone(s)
        return s

    @property
    def sender_number_canonical(self) -> Optional[str]:
        if not self.sender_number:
            return None
        return canonicalize_bd_phone(self.sender_number)


class TransactionObservationView(BaseModel):
    id: str
    transaction_id: str
    payment_account_id: str
    source: str = "manual"
    actor: str
    amount_minor: int
    sender_number_raw: Optional[str] = None
    sender_number_canonical: Optional[str] = None
    occurred_at: Optional[datetime.datetime] = None
    parse_state: ParseState = "valid"
    conflict_state: ConflictState = "none"
    created_at: datetime.datetime


class ReceiptView(BaseModel):
    id: str
    shop_id: str
    payment_account_id: str
    provider: str
    trx_id: str
    amount_minor: int
    sender_number_raw: Optional[str] = None
    sender_number_canonical: Optional[str] = None
    occurred_at: Optional[datetime.datetime] = None
    reconciliation_state: ReconciliationState = "unmatched"
    has_conflict: bool = False
    version: int = 1
    created_at: datetime.datetime
    updated_at: datetime.datetime
    observations: List[TransactionObservationView] = []
    related_claims_count: int = 0


class ReceiptListResponse(BaseModel):
    items: List[ReceiptView]
    next_cursor: Optional[str] = None
