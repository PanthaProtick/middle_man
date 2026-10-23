import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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
    total_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    required_advance_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    account_provider: Mapped[str] = mapped_column(String(32), nullable=False)
    account_receiving_number: Mapped[str] = mapped_column(String(20), nullable=False)
    account_label: Mapped[str] = mapped_column(String(200), nullable=False)

    # Lifecycle and versions
    lifecycle: Mapped[str] = mapped_column(String(32), default="awaiting_buyer", nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    buyer_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_submitted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    shop: Mapped["ShopTable"] = relationship("ShopTable", back_populates="orders")
    payment_account: Mapped["PaymentAccountTable"] = relationship("PaymentAccountTable")
    revisions: Mapped[list["BuyerRevisionTable"]] = relationship("BuyerRevisionTable", back_populates="order")
    allocation: Mapped["AllocationTable | None"] = relationship("AllocationTable", back_populates="order", uselist=False)
    review_reasons: Mapped[list["OrderReviewReasonTable"]] = relationship("OrderReviewReasonTable", back_populates="order")


class BuyerRevisionTable(Base):
    __tablename__ = "buyer_revisions"
    __table_args__ = (UniqueConstraint("order_id", "revision_number", name="uq_buyer_order_revision"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), nullable=False, index=True)
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    claim_accepted_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    buyer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_number_raw: Mapped[str] = mapped_column(String(32), nullable=False)
    contact_number_canonical: Mapped[str] = mapped_column(String(20), nullable=False)
    address_raw: Mapped[str] = mapped_column(Text, nullable=False)
    address_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_thana: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_area: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_street_line: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_landmark: Mapped[str | None] = mapped_column(String(200), nullable=True)
    payment_provider: Mapped[str] = mapped_column(String(32), nullable=False)
    payment_trx_id: Mapped[str] = mapped_column(String(128), nullable=False)
    payment_sender_raw: Mapped[str] = mapped_column(String(32), nullable=False)
    payment_sender_canonical: Mapped[str] = mapped_column(String(20), nullable=False)
    payment_amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    payment_claimed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_evidence_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="buyer", nullable=False)
    actor: Mapped[str] = mapped_column(String(32), default="buyer", nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    order: Mapped["OrderTable"] = relationship("OrderTable", back_populates="revisions")


class LinkMeasurementTable(Base):
    __tablename__ = "link_measurements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    token_lookup_digest: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    is_bot_or_repeat: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)


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


class ReceivedTransactionTable(Base):
    __tablename__ = "received_transactions"
    __table_args__ = (
        UniqueConstraint("shop_id", "provider", "trx_id", name="uq_received_transactions_identity"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    payment_account_id: Mapped[str] = mapped_column(String(36), ForeignKey("payment_accounts.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    trx_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sender_number_raw: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sender_number_canonical: Mapped[str | None] = mapped_column(String(20), nullable=True)
    occurred_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reconciliation_state: Mapped[str] = mapped_column(String(32), default="unmatched", nullable=False, index=True)
    has_conflict: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    shop: Mapped["ShopTable"] = relationship("ShopTable")
    payment_account: Mapped["PaymentAccountTable"] = relationship("PaymentAccountTable")
    observations: Mapped[list["TransactionObservationTable"]] = relationship(
        "TransactionObservationTable", back_populates="transaction"
    )


class TransactionObservationTable(Base):
    __tablename__ = "transaction_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    transaction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("received_transactions.id"), nullable=False, index=True
    )
    payment_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("payment_accounts.id"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(32), default="manual", nullable=False)
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sender_number_raw: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sender_number_canonical: Mapped[str | None] = mapped_column(String(20), nullable=True)
    occurred_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    parse_state: Mapped[str] = mapped_column(String(32), default="valid", nullable=False)
    conflict_state: Mapped[str] = mapped_column(String(32), default="none", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    transaction: Mapped["ReceivedTransactionTable"] = relationship(
        "ReceivedTransactionTable", back_populates="observations"
    )
    payment_account: Mapped["PaymentAccountTable"] = relationship("PaymentAccountTable")


class AllocationTable(Base):
    __tablename__ = "allocations"
    __table_args__ = (
        UniqueConstraint("order_id", name="uq_allocations_order_id"),
        UniqueConstraint("transaction_id", name="uq_allocations_transaction_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), nullable=False, index=True)
    transaction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("received_transactions.id"), nullable=False, index=True
    )
    accepted_amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    basis: Mapped[str] = mapped_column(String(32), default="automatic", nullable=False)
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    order: Mapped["OrderTable"] = relationship("OrderTable", back_populates="allocation")
    transaction: Mapped["ReceivedTransactionTable"] = relationship("ReceivedTransactionTable")


class UsedPaymentMarkerTable(Base):
    __tablename__ = "used_payment_markers"
    __table_args__ = (
        UniqueConstraint("shop_id", "provider", "transaction_digest", name="uq_used_payment_markers_digest"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    transaction_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class AuditEventTable(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("shops.id"), nullable=False, index=True)
    aggregate_type: Mapped[str] = mapped_column(String(32), nullable=False)
    aggregate_id: Mapped[str] = mapped_column(String(36), nullable=False)
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class OrderReviewReasonTable(Base):
    __tablename__ = "order_review_reasons"
    __table_args__ = (
        UniqueConstraint("order_id", "reason", name="uq_order_review_reason"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    order: Mapped["OrderTable"] = relationship("OrderTable", back_populates="review_reasons")


