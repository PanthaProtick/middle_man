"""Private raw evidence is separate from permanent, structured import outcomes."""
import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SmsEvidenceTable(Base):
    __tablename__ = 'sms_evidence'
    __table_args__ = (UniqueConstraint('shop_id', 'text_digest', name='uq_sms_evidence_digest'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), index=True)
    owner_id: Mapped[str] = mapped_column(String(128))
    text_digest: Mapped[str] = mapped_column(String(64))
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    collected_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    delete_after: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), index=True)


class SmsImportTable(Base):
    __tablename__ = 'sms_imports'
    __table_args__ = (UniqueConstraint('shop_id', 'mutation_key', name='uq_sms_import_key'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), index=True)
    mutation_key: Mapped[str] = mapped_column(String(128))
    payload_hash: Mapped[str] = mapped_column(String(64))
    result_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), index=True)
