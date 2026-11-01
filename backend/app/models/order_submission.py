from typing import Literal

from pydantic import BaseModel

from app.models.order import SellerOrder


class SubmissionContext(BaseModel):
    storage_epoch: str


class SubmissionResult(BaseModel):
    state: Literal['not_found', 'succeeded']
    order: SellerOrder | None = None
