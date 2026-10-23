import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ShopTable(Base):
    __tablename__ = "shops"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    accounts: Mapped[list["PaymentAccountTable"]] = relationship(
        "PaymentAccountTable", back_populates="shop"
    )
    orders: Mapped[list["OrderTable"]] = relationship("OrderTable", back_populates="shop")


class PaymentAccountTable(Base):
    __tablename__ = "payment_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    receiving_number: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    shop: Mapped["ShopTable"] = relationship("ShopTable", back_populates="accounts")


class OrderTable(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    payment_account_id: Mapped[str] = mapped_column(String(36), ForeignKey("payment_accounts.id"), nullable=False, index=True)
    token_lookup_digest: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    encrypted_portal_token: Mapped[str] = mapped_column(Text, nullable=False)

    # Snapshot of commercial terms & receiving account details
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    total_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    required_advance_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    account_provider: Mapped[str] = mapped_column(String(32), nullable=False)
    account_receiving_number: Mapped[str] = mapped_column(String(20), nullable=False)
    account_label: Mapped[str] = mapped_column(String(200), nullable=False)

    # Lifecycle and versions
    lifecycle: Mapped[str] = mapped_column(String(32), default="awaiting_buyer", nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    shop: Mapped["ShopTable"] = relationship("ShopTable", back_populates="orders")
    payment_account: Mapped["PaymentAccountTable"] = relationship("PaymentAccountTable")


class IdempotencyRecordTable(Base):
    __tablename__ = "idempotency_records"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    scope: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    response_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )
