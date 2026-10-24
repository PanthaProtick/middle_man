"""Anonymous shop-level counters outlive personal order details."""
from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PaymentMetricsTable(Base):
    __tablename__ = 'payment_metrics'
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey('shops.id'), primary_key=True)
    confirmed_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    manual_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    exception_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
