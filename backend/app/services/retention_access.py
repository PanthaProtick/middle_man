"""A removed record never masquerades as an expired order."""
from typing import Any

from app.models.entities import OrderTable
from app.services.seller_service import SellerDomainException


def unavailable_record() -> SellerDomainException:
    return SellerDomainException(410, 'RECORD_UNAVAILABLE', 'Order record unavailable. Please contact the seller.')


def require_retained_record(record: OrderTable | dict[str, Any]) -> None:
    removed = record.retained_at if isinstance(record, OrderTable) else record.get('retained_at')
    if removed:
        raise unavailable_record()
