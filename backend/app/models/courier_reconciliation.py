"""Versioned seller reconciliation input and durable resolution history."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.courier_submission import ReconciliationAction
from app.models.pathao import Environment


class CourierReconciliationInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    attempt_id: str = Field(min_length=1, max_length=36)
    expected_version: int = Field(ge=0)
    action: ReconciliationAction
    environment: Environment | None = None
    consignment_id: str | None = Field(default=None, min_length=1, max_length=64)
    merchant_order_id: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode='after')
    def require_action_evidence(self) -> 'CourierReconciliationInput':
        if self.action == 'attach_existing':
            if not self.consignment_id or not self.merchant_order_id or self.environment is None:
                raise ValueError(
                    'Attaching an existing consignment requires consignment_id, merchant_order_id, and environment.'
                )
        elif self.consignment_id is not None or self.merchant_order_id is not None or self.environment is not None:
            raise ValueError('Confirmed noncreation does not accept consignment evidence.')
        return self


class CourierReconciliationTable(Base):
    __tablename__ = 'courier_reconciliations'

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    attempt_id: Mapped[str] = mapped_column(String(36), ForeignKey('courier_attempts.id'), nullable=False)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey('orders.id'), nullable=False)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    resolution_version: Mapped[int] = mapped_column(Integer, nullable=False)
    resulting_status: Mapped[str] = mapped_column(String(16), nullable=False)
    environment: Mapped[str] = mapped_column(String(16), nullable=False)
    consignment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    merchant_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    evidence: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
