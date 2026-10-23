from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

from app.models.buyer import PublicOrder
from app.models.entities import OrderTable


class PublicTerms(BaseModel):
    """Allowlist shared by SQL and standby records; personal fields cannot enter it."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    product_name: str
    total_minor: int
    required_advance_minor: int
    account_provider: str
    account_receiving_number: str
    account_label: str
    lifecycle: Literal["awaiting_buyer", "pending", "confirmed", "rejected", "cancelled", "expired"]
    created_at: datetime
    expires_at: datetime
    completed_at: datetime | None = None


def get_status_message(lifecycle: str) -> str:
    if lifecycle == "awaiting_buyer":
        return "Please review the order details and submit your payment and delivery information."
    elif lifecycle == "pending":
        return "Your submission has been received and is pending seller review."
    elif lifecycle == "confirmed":
        return "Your order has been confirmed by the seller."
    elif lifecycle == "expired":
        return "This order link has expired. Please contact the seller for a new link."
    elif lifecycle == "rejected":
        return "This order has been declined. Please contact the seller."
    elif lifecycle == "cancelled":
        return "This order has been cancelled. Please contact the seller."
    return f"Order status: {lifecycle}"


def to_public_order(
    order: OrderTable | dict[str, Any],
    shop_display_name: str,
    accepted_amount_minor: Optional[int] = None,
) -> PublicOrder:
    terms = PublicTerms.model_validate(order)
    actual_cod = (
        terms.total_minor - accepted_amount_minor
        if terms.lifecycle == "confirmed" and accepted_amount_minor is not None
        else None
    )
    return PublicOrder(
        **terms.model_dump(),
        shop_display_name=shop_display_name,
        expected_cod_minor=terms.total_minor - terms.required_advance_minor,
        actual_cod_minor=actual_cod,
        status_message=get_status_message(terms.lifecycle),
        submission_acknowledgement=f"ACK-{terms.id[:8].upper()}" if terms.lifecycle in ("pending", "confirmed") else None,
    )
