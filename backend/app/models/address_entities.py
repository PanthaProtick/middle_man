"""Raw evidence has a fixed deadline, separate from structured replay outcomes."""
import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AddressExtractionTable(Base):
    __tablename__ = "address_extractions"
    __table_args__ = (UniqueConstraint("order_id", "mutation_key", name="uq_address_extraction_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("shops.id"), index=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    mutation_key: Mapped[str] = mapped_column(String(64))
    payload_hash: Mapped[str] = mapped_column(String(64))
    result_json: Mapped[str] = mapped_column(Text)
    raw_request: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    collected_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    delete_after: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), index=True)
