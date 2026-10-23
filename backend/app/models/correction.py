from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.buyer import Address, BuyerSubmission, PaymentClaim
from app.models.seller import canonicalize_bd_phone


class BuyerCorrection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_version: int = Field(gt=0, strict=True)
    reason: str = Field(min_length=1, max_length=1000)
    buyer_name: str | None = Field(None, min_length=1, max_length=200)
    contact_number: str | None = Field(None, min_length=1, max_length=32)
    address: Address | None = None
    payment_claim: PaymentClaim | None = None

    @field_validator('buyer_name')
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is not None:
            return BuyerSubmission.clean_name(value)
        return value

    @field_validator('contact_number')
    @classmethod
    def validate_contact(cls, value: str | None) -> str | None:
        if value is not None:
            canonicalize_bd_phone(value)
        return value

    @model_validator(mode='after')
    def validate_changes(self) -> 'BuyerCorrection':
        self.reason = self.reason.strip()
        changes = self.model_fields_set - {'expected_version', 'reason'}
        if not self.reason or not changes or any(getattr(self, name) is None for name in changes):
            raise ValueError('Supply a reason and at least one non-null correction')
        return self


class BuyerRevisionView(BuyerSubmission):
    id: str
    revision_number: int
    actor: str
    reason: str | None
    created_at: datetime
    claim_accepted_at: datetime


class BuyerHistory(BaseModel):
    items: list[BuyerRevisionView]
    next_cursor: str | None = None
