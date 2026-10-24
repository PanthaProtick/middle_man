"""Untrusted screenshot suggestions; never seller receipt evidence."""

import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

PaymentField = Literal[
    "is_payment_screenshot", "provider", "trx_id", "amount_minor", "sender_number", "receiver_number", "occurred_at"
]


class PaymentExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    evidence_id: str = Field(min_length=1, max_length=36)
    ai_opt_in: Literal[True]

    @field_validator("ai_opt_in", mode="before")
    @classmethod
    def explicit_consent(cls, value: object) -> object:
        if value is not True:
            raise ValueError("Explicit AI opt-in required")
        return value


class PaymentSuggestions(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    is_payment_screenshot: bool | None
    provider: Literal["bkash", "nagad"] | None
    trx_id: str | None = Field(max_length=128)
    amount_minor: int | None = Field(ge=1, le=100_000_000_00)
    sender_number: str | None = Field(max_length=32)
    receiver_number: str | None = Field(max_length=32)
    occurred_at: datetime.datetime | None
    unreadable_fields: list[PaymentField] = Field(max_length=7)

    @field_validator("occurred_at")
    @classmethod
    def timezone_required(cls, value: datetime.datetime | None) -> datetime.datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("Time must include timezone")
        return value


class PaymentExtractionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    available: bool
    evidence_id: str
    suggestions: PaymentSuggestions | None = None
    review_required: Literal[True] = True
    message: str
