import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.order import SellerOrder

PreparationReason = Literal["AWAITING_COURIER_PREPARATION", "PRIOR_DAY_BACKLOG"]
AttentionCategory = Literal[
    "unknown_outcome", "failed_submission", "pending_review", "preparation", "awaiting_buyer"
]
AttentionReason = Literal[
    "UNKNOWN_OUTCOME",
    "FAILED_SUBMISSION",
    "PENDING_REVIEW",
    "AWAITING_BUYER_SUBMISSION",
    "AWAITING_COURIER_PREPARATION",
    "PRIOR_DAY_BACKLOG",
]


class PreparationPreviewItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order: SellerOrder
    reason_codes: list[PreparationReason]


class PreparationQueryPreview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: Literal["preparation"] = "preparation"
    items: list[PreparationPreviewItem]
    total: int
    next_cursor: str | None = None
    retrieved_at: datetime.datetime
    calendar_date: datetime.date
    timezone: Literal["Asia/Dhaka"] = "Asia/Dhaka"


class AttentionPreviewItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order: SellerOrder
    category: AttentionCategory
    reason_codes: list[AttentionReason]


class AttentionQueryPreview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: Literal["attention"] = "attention"
    items: list[AttentionPreviewItem]
    total: int
    next_cursor: str | None = None
    retrieved_at: datetime.datetime
    calendar_date: datetime.date
    timezone: Literal["Asia/Dhaka"] = "Asia/Dhaka"
