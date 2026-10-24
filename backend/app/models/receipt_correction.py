"""Typed partial receipt edits and structured, immutable correction history."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.transaction import ManualReceipt


class ReceiptCorrection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=1000)
    payment_account_id: str | None = Field(None, min_length=1, max_length=36)
    provider: Literal["bkash", "nagad"] | None = None
    trx_id: str | None = Field(None, min_length=1, max_length=128)
    amount_minor: int | None = Field(None, gt=0, le=100_000_000_000, strict=True)
    sender_number: str | None = Field(None, max_length=32)
    occurred_at: datetime | None = None

    @field_validator("reason")
    @classmethod
    def nonblank_reason(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Explain the receipt correction")
        return value.strip()

    @model_validator(mode="after")
    def validate_edit(self) -> "ReceiptCorrection":
        edits = self.model_fields_set - {"expected_version", "reason"}
        if not edits:
            raise ValueError("Supply at least one corrected field")
        for name in edits - {"sender_number", "occurred_at"}:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        if self.occurred_at is not None and self.occurred_at.utcoffset() is None:
            raise ValueError("Receipt time must include a timezone")
        return self


class ReceiptSnapshot(ManualReceipt):
    has_conflict: bool


class ReceiptCorrectionEvent(BaseModel):
    before: ReceiptSnapshot
    after: ReceiptSnapshot
    observation_id: str
    reason: str
    actor: str
    created_at: datetime
