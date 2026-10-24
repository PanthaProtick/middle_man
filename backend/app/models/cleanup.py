import datetime
from typing import Literal, Optional

from pydantic import BaseModel
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EvidenceCleanupTable(Base):
    __tablename__ = "evidence_cleanups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("shops.id"), nullable=True, index=True)
    ran_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    items_purged: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    items_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CleanupFailureItem(BaseModel):
    evidence_type: str
    evidence_id: str
    order_id: Optional[str] = None
    delete_after: datetime.datetime
    error: str


class RetentionStatusResponse(BaseModel):
    shop_id: str
    checked_at: datetime.datetime
    counts: dict[str, int]
    overdue_count: int
    failed_count: int
    last_cleanup_at: Optional[datetime.datetime] = None
    overdue_items: list[CleanupFailureItem] = []


class RetentionCleanupResponse(BaseModel):
    shop_id: str
    ran_at: datetime.datetime
    items_purged: int
    items_failed: int
    overdue_remaining: int
    status: Literal["clean", "partial_failure", "failed"]
    failures: list[CleanupFailureItem] = []
