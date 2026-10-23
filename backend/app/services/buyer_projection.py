from typing import Any

from app.models.buyer import PublicOrder
from app.models.entities import OrderTable


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


def to_public_order(order_dict_or_row: Any, shop_display_name: str) -> PublicOrder:
    if isinstance(order_dict_or_row, OrderTable):
        lifecycle = str(order_dict_or_row.lifecycle)
        total_minor = int(order_dict_or_row.total_minor)
        required_advance_minor = int(order_dict_or_row.required_advance_minor)
        order_id = str(order_dict_or_row.id)
        return PublicOrder(
            id=order_id,
            shop_display_name=shop_display_name,
            product_name=str(order_dict_or_row.product_name),
            total_minor=total_minor,
            required_advance_minor=required_advance_minor,
            expected_cod_minor=total_minor - required_advance_minor,
            actual_cod_minor=None,
            account_provider=str(order_dict_or_row.account_provider),
            account_receiving_number=str(order_dict_or_row.account_receiving_number),
            account_label=str(order_dict_or_row.account_label),
            lifecycle=lifecycle,  # type: ignore[arg-type]
            status_message=get_status_message(lifecycle),
            submission_acknowledgement=f"ACK-{order_id[:8].upper()}" if lifecycle in ("pending", "confirmed") else None,
            created_at=order_dict_or_row.created_at,
            expires_at=order_dict_or_row.expires_at,
            completed_at=order_dict_or_row.completed_at,
        )

    # In-memory dict
    lifecycle = str(order_dict_or_row["lifecycle"])
    total_minor = int(order_dict_or_row["total_minor"])
    required_advance_minor = int(order_dict_or_row["required_advance_minor"])
    order_id = str(order_dict_or_row["id"])
    return PublicOrder(
        id=order_id,
        shop_display_name=shop_display_name,
        product_name=str(order_dict_or_row["product_name"]),
        total_minor=total_minor,
        required_advance_minor=required_advance_minor,
        expected_cod_minor=total_minor - required_advance_minor,
        actual_cod_minor=None,
        account_provider=str(order_dict_or_row["account_provider"]),
        account_receiving_number=str(order_dict_or_row["account_receiving_number"]),
        account_label=str(order_dict_or_row["account_label"]),
        lifecycle=lifecycle,  # type: ignore[arg-type]
        status_message=get_status_message(lifecycle),
        submission_acknowledgement=f"ACK-{order_id[:8].upper()}" if lifecycle in ("pending", "confirmed") else None,
        created_at=order_dict_or_row["created_at"],
        expires_at=order_dict_or_row["expires_at"],
        completed_at=order_dict_or_row.get("completed_at"),
    )
