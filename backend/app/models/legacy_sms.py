"""Historical persisted SMS results retained solely for privacy redaction."""
import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.transaction import ManualReceipt

ImportState = Literal['imported', 'duplicate', 'conflicting', 'unsupported', 'missing', 'masked', 'ambiguous', 'provider_mismatch']


class SmsItemResult(BaseModel):
    index: int
    state: ImportState
    issues: list[str] = Field(default_factory=list)
    fields: ManualReceipt | None = None
    receipt_id: str | None = None
    order_ids: list[str] = Field(default_factory=list)
    evidence_id: str
    collected_at: datetime.datetime
    delete_after: datetime.datetime


class ImportResult(BaseModel):
    id: str
    payment_account_id: str
    created_at: datetime.datetime
    items: list[SmsItemResult]
