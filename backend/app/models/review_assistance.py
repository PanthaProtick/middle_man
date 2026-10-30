from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_serializer


class ReviewAssistanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: Literal["en", "bn"] = "en"
    receipt_id: Optional[str] = Field(default=None, min_length=1, max_length=36)


AutomaticReviewReason = Literal[
    "SENDER_MISMATCH",
    "AMOUNT_MISMATCH",
    "TIME_UNCLEAR",
    "WRONG_RECEIVING_ACCOUNT",
    "CONFLICTING_RECEIPTS",
    "COMPETING_CLAIMS",
    "PAYMENT_USED",
]
ReviewCondition = Literal[
    "NO_RECORDED_RECEIPT",
    "UNKNOWN_CAUSE",
    "UNSUPPORTED_REASON_CODE",
    "SENDER_MISMATCH",
    "AMOUNT_MISMATCH",
    "TIME_UNCLEAR",
    "WRONG_RECEIVING_ACCOUNT",
    "CONFLICTING_RECEIPTS",
    "COMPETING_CLAIMS",
    "PAYMENT_USED",
    "MULTIPLE_REVIEW_REASONS",
]
ReviewAction = Literal["CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS"]
SenderStatus = Literal["missing", "different"]
TimeStatus = Literal["missing", "before_order_creation", "after_claim_submission"]
ConflictCategory = Literal["amount", "receiving_account", "sender", "time"]


class ReviewFacts(BaseModel):
    has_matching_receipt: bool
    required_advance_minor: Optional[int] = None
    claimed_amount_minor: Optional[int] = None
    received_amount_minor: Optional[int] = None
    currency: Optional[Literal["BDT"]] = None
    sender_status: Optional[SenderStatus] = None
    time_status: Optional[TimeStatus] = None
    receiving_account_comparison: Optional[Literal["different"]] = None
    conflict_categories: Optional[list[ConflictCategory]] = None
    active_claim_count: Optional[int] = None
    claim_held_by_prior_resolution: Optional[bool] = None
    payment_used: Optional[bool] = None
    payment_allocated: Optional[bool] = None
    provider_comparison: Optional[Literal["same", "different"]] = None
    transaction_id_comparison: Optional[Literal["same", "different"]] = None
    total_minor: Optional[int] = None

    @model_serializer(mode="wrap")
    def _omit_none(self, handler):  # type: ignore[no-untyped-def]
        return {key: value for key, value in handler(self).items() if value is not None}


class SuggestedAction(BaseModel):
    action_id: ReviewAction
    label: str
    target: Literal["transactions", "buyer_tab"]
    description: Optional[str] = None


class ReviewProviderContext(BaseModel):
    """Explicit provider allowlist: no identifiers, names, contacts, or raw records."""

    condition: ReviewCondition
    reason_codes: list[AutomaticReviewReason] = Field(default_factory=list)
    unknown_reason_present: bool = False
    locale: Literal["en", "bn"] = "en"
    facts: ReviewFacts
    permitted_actions: list[ReviewAction] = Field(default_factory=list)
    selected_preview: Optional["SelectedPreviewContext"] = None

    @model_serializer(mode="wrap")
    def _omit_none(self, handler):  # type: ignore[no-untyped-def]
        return {key: value for key, value in handler(self).items() if value is not None}


class SelectedPreviewContext(BaseModel):
    conditions: list[str]
    blockers: list[str]


class ReviewAssistanceResponse(BaseModel):
    order_id: str
    order_version: int
    buyer_revision: Optional[int] = None
    lifecycle: Literal["pending"]
    source: Literal["local", "generated"] = "local"
    condition: ReviewCondition
    context_token: str
    reason_codes: list[AutomaticReviewReason] = Field(default_factory=list)
    unknown_reason_present: bool = False
    explanation: str
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    facts: ReviewFacts
    context: ReviewProviderContext
    locale: Literal["en", "bn"] = "en"
    selected_receipt_id: Optional[str] = None
    selected_receipt_version: Optional[int] = None
    preview_conditions: list[str] = Field(default_factory=list)
    preview_blockers: list[str] = Field(default_factory=list)
