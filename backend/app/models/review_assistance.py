from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ReviewAssistanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: Literal["en", "bn"] = "en"
    receipt_id: Optional[str] = Field(default=None, max_length=36)


ReviewCondition = Literal["NO_RECORDED_RECEIPT", "UNKNOWN_CAUSE", "UNSUPPORTED_REASON_CODE"]
ReviewAction = Literal["CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS"]


class ReviewFacts(BaseModel):
    has_matching_receipt: bool


class SuggestedAction(BaseModel):
    action_id: ReviewAction
    label: str
    target: Literal["transactions", "buyer_tab"]
    description: Optional[str] = None


class ReviewAssistanceResponse(BaseModel):
    order_id: str
    order_version: int
    buyer_revision: Optional[int] = None
    lifecycle: Literal["pending"]
    source: Literal["local", "generated"] = "local"
    condition: ReviewCondition
    context_token: str
    reason_codes: list[str] = Field(default_factory=list)
    explanation: str
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    facts: ReviewFacts
    locale: Literal["en", "bn"] = "en"
