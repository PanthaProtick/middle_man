"""Local courier proposal contract and durable creation marker."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CourierDraftTable(Base):
    __tablename__ = 'courier_drafts'

    # The order identity is also the draft identity: one proposal per order.
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey('orders.id'), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class CourierDraft(BaseModel):
    order_id: str
    created_at: datetime
    status: Literal['local_proposal'] = 'local_proposal'
    recipient_name: str
    contact_number: str
    address: str
    remaining_cod_minor: int = Field(ge=0)
    blockers: list[Literal['PARCEL_DETAILS_REQUIRED', 'COURIER_CONNECTION_REQUIRED',
                          'LOCATION_METADATA_REQUIRED', 'ORDER_NOT_CONFIRMED']]
