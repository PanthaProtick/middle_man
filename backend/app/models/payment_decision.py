"""Seller approval contracts, binding the preview to both mutable versions."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.transaction import ReceiptView


class DecisionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["confirm", "reject", "cancel"]
    expected_version: int = Field(ge=1, strict=True)
    reason: str = Field(min_length=1, max_length=2000)
    expected_transaction_version: int | None = Field(None, ge=1, strict=True)
    transaction_id: str | None = Field(None, min_length=1, max_length=36)
    accepted_amount_minor: int | None = Field(None, gt=0, le=9007199254740991, strict=True)

    @field_validator("reason")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Explain the seller decision")
        return value.strip()

    @model_validator(mode="after")
    def validate_action_fields(self) -> "DecisionInput":
        if self.action == "confirm":
            if not self.transaction_id:
                raise ValueError("Manual confirmation requires transaction_id")
            if self.accepted_amount_minor is None:
                raise ValueError("Manual confirmation requires previewed accepted_amount_minor")
            if self.expected_transaction_version is None:
                raise ValueError("Manual confirmation requires expected_transaction_version")
        else:
            if self.transaction_id is not None:
                raise ValueError(f"{self.action.capitalize()} does not accept transaction_id")
            if self.accepted_amount_minor is not None:
                raise ValueError(f"{self.action.capitalize()} does not accept accepted_amount_minor")
            if self.expected_transaction_version is not None:
                raise ValueError(f"{self.action.capitalize()} does not accept expected_transaction_version")
        return self


PaymentDecision = DecisionInput


class PaymentPreview(BaseModel):
    order_id: str
    expected_version: int
    expected_transaction_version: int
    receipt: ReceiptView
    claim_provider: str
    claim_trx_id: str
    claim_sender: str
    claim_amount_minor: int
    claim_submitted_at: datetime
    order_created_at: datetime
    account_provider: str
    payment_account_id: str
    total_minor: int
    required_advance_minor: int
    accepted_amount_minor: int
    actual_cod_minor: int | None
    exceptions: list[str]
    blockers: list[str]


class PaymentDecisionEvent(BaseModel):
    transaction_id: str
    accepted_amount_minor: int
    actual_cod_minor: int
    exceptions: list[str]
    reason: str
    actor: str
    created_at: datetime


class PaymentSummary(BaseModel):
    confirmed_count: int = 0
    manual_count: int = 0
    exception_count: int = 0
