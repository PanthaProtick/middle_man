import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

OrderStatus = Literal['awaiting_buyer', 'pending', 'confirmed', 'rejected', 'cancelled', 'expired']


class ExportFilters(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: OrderStatus | None = None
    search: str | None = Field(None, max_length=200)
    from_date: datetime.date | None = None
    to_date: datetime.date | None = None
    limit: int = Field(500, ge=1, le=500)


class OrderSummary(BaseModel):
    order_id: str
    product: str
    lifecycle: OrderStatus
    buyer_name: str = ''
    contact_number: str = ''
    address: str = ''
    total_bdt: str
    required_advance_bdt: str
    accepted_advance_bdt: str = ''
    expected_cod_bdt: str
    actual_cod_bdt: str = ''
    purpose: str = 'Manual delivery aid only; no courier booking, update or delivery-price calculation.'
