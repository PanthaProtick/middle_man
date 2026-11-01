import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.order import SellerOrder

PreparationReason = Literal["AWAITING_COURIER_PREPARATION", "PRIOR_DAY_BACKLOG"]


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
