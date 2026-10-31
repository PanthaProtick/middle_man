"""Merchant-scoped published catalogues and durable refresh leases."""
import datetime

from pydantic import BaseModel
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CatalogSnapshotTable(Base):
    __tablename__ = 'pathao_catalog_snapshots'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), index=True)
    environment: Mapped[str] = mapped_column(String(16))
    connection_version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    retired_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


class CatalogListTable(Base):
    __tablename__ = 'pathao_catalog_lists'
    snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey('pathao_catalog_snapshots.id', ondelete='CASCADE'), primary_key=True)
    level: Mapped[str] = mapped_column(String(8), primary_key=True)
    parent_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    choices_json: Mapped[str] = mapped_column(Text)


class CatalogSyncTable(Base):
    __tablename__ = 'pathao_catalog_sync'
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), primary_key=True)
    environment: Mapped[str] = mapped_column(String(16), primary_key=True)
    connection_version: Mapped[int] = mapped_column(Integer)
    lease_id: Mapped[str | None] = mapped_column(String(36))
    lease_until: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
    attempted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
    failed: Mapped[bool] = mapped_column(Boolean, default=False)


class CatalogStatus(BaseModel):
    catalog_version: str | None = None
    refreshed_at: datetime.datetime | None = None
    attempted_at: datetime.datetime | None = None
    refreshing: bool = False
    failed: bool = False
