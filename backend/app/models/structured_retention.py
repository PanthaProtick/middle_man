"""Minimal key binding and seller cleanup status contracts."""
from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PaymentMarkerKeyTable(Base):
    __tablename__ = 'payment_marker_keys'
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64))


class StructuredRetentionStatus(BaseModel):
    checked_at: datetime
    overdue: int = 0
    failed: int = 0
    removed: int = 0
    standby: bool = False
