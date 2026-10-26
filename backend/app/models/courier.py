"""Local courier proposal contract and durable editable creation marker."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.order import MAX_PARCEL_QUANTITY, MAX_PARCEL_WEIGHT_GRAMS


class CourierDraftTable(Base):
    __tablename__ = 'courier_drafts'

    # The order identity is also the draft identity: one proposal per order.
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey('orders.id'), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    parcel_weight_grams: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parcel_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class CourierDraftUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_version: int = Field(gt=0, strict=True)
    parcel_weight_grams: int | None = Field(
        None, strict=True, ge=1, le=MAX_PARCEL_WEIGHT_GRAMS
    )
    parcel_quantity: int | None = Field(None, strict=True, ge=1, le=MAX_PARCEL_QUANTITY)

    @model_validator(mode='after')
    def require_parcel_change(self) -> 'CourierDraftUpdate':
        changes = self.model_fields_set - {'expected_version'}
        if not changes or any(getattr(self, name) is None for name in changes):
            raise ValueError('Supply at least one non-null parcel detail')
        return self


class CourierDraft(BaseModel):
    order_id: str
    created_at: datetime
    version: int
    status: Literal['local_proposal'] = 'local_proposal'
    recipient_name: str
    contact_number: str
    address: str
    remaining_cod_minor: int = Field(ge=0)
    parcel_weight_grams: int | None
    parcel_quantity: int | None
    missing_parcel_fields: list[Literal['weight', 'quantity']]
    blockers: list[Literal['PARCEL_DETAILS_REQUIRED', 'COURIER_CONNECTION_REQUIRED',
                          'LOCATION_METADATA_REQUIRED', 'ORDER_NOT_CONFIRMED']]
