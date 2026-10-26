"""Durable attempt tracking, outcome states, and reviewed booking snapshot contract."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.pathao import Environment

AttemptStatus = Literal['submitting', 'success', 'failed', 'unknown']


class CourierAttemptTable(Base):
    __tablename__ = 'courier_attempts'

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey('orders.id'), nullable=False)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    environment: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    reviewed_token: Mapped[str] = mapped_column(String(64), nullable=False)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    consignment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    booking_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class CourierBookingSnapshot(BaseModel):
    model_config = ConfigDict(extra='forbid')
    order_id: str
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    city_id: int
    zone_id: int
    area_id: int | None = None
    store_id: int
    delivery_type: int
    item_weight_grams: int
    item_quantity: int
    amount_to_collect_bdt: int
    remaining_cod_minor: int


class CourierAttemptView(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str
    order_id: str
    attempt_number: int
    status: AttemptStatus
    environment: Environment
    simulated: bool
    reviewed_token: str
    correlation_id: str
    consignment_id: str | None = None
    booking_snapshot: CourierBookingSnapshot | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class CourierSubmissionInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_token: str = Field(pattern=r'^[a-f0-9]{64}$')


def to_attempt_view(row: CourierAttemptTable | dict[str, Any]) -> CourierAttemptView:
    if isinstance(row, CourierAttemptTable):
        snapshot = CourierBookingSnapshot.model_validate(row.booking_snapshot) if row.booking_snapshot else None
        return CourierAttemptView(
            id=row.id,
            order_id=row.order_id,
            attempt_number=row.attempt_number,
            status=row.status,  # type: ignore[arg-type]
            environment=row.environment,  # type: ignore[arg-type]
            simulated=row.environment == 'offline',
            reviewed_token=row.reviewed_token,
            correlation_id=row.correlation_id,
            consignment_id=row.consignment_id,
            booking_snapshot=snapshot,
            error_code=row.error_code,
            error_message=row.error_message,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
    snapshot = CourierBookingSnapshot.model_validate(row['booking_snapshot']) if row.get('booking_snapshot') else None
    return CourierAttemptView(
        id=row['id'],
        order_id=row['order_id'],
        attempt_number=row['attempt_number'],
        status=row['status'],
        environment=row['environment'],
        simulated=row['environment'] == 'offline',
        reviewed_token=row['reviewed_token'],
        correlation_id=row['correlation_id'],
        consignment_id=row.get('consignment_id'),
        booking_snapshot=snapshot,
        error_code=row.get('error_code'),
        error_message=row.get('error_message'),
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )

