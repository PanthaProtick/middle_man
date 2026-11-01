from typing import Literal

from pydantic import BaseModel, Field

from app.models.transaction import ReceiptView


class TransactionSubmissionContext(BaseModel):
    storage_epoch: str


class RecordedTransactionResult(BaseModel):
    receipt: ReceiptView
    allocated_order_ids: list[str] = Field(default_factory=list)


class TransactionSubmissionLookup(BaseModel):
    state: Literal["not_found", "succeeded"]
    result: RecordedTransactionResult | None = None
