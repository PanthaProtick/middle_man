"""Seller-only evidence comparison and explicit decisions; no matching overrides."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.receipt_correction import ReceiptCorrectionEvent
from app.models.transaction import ReceiptView


class ResolutionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=2000)
    selected_observation_id: str = Field(min_length=1, max_length=36)
    selected_order_id: str | None = Field(None, min_length=1, max_length=36)

    @field_validator("reason")
    @classmethod
    def nonblank_reason(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Explain the seller decision")
        return value.strip()


class ResolutionDecision(BaseModel):
    selected_observation_id: str
    selected_order_id: str | None
    rejected_revision_ids: list[str]
    reason: str
    actor: str
    created_at: datetime


class ClaimComparison(BaseModel):
    order_id: str
    revision_id: str
    lifecycle: str
    buyer_name: str
    sender_number: str
    amount_minor: int
    submitted_at: datetime
    review_reasons: list[str]
    held_by_resolution: bool = False


class ReceiptComparison(BaseModel):
    receipt: ReceiptView
    claims: list[ClaimComparison]
    allocated_order_id: str | None
    history: list[ResolutionDecision]
    corrections: list[ReceiptCorrectionEvent] = []
