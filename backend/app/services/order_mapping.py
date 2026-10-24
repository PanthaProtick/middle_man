"""Mapping and expiry helpers for SellerOrder domain models."""
import datetime
from typing import Any, List, Optional

from app.core.tokens import decrypt_token
from app.models.entities import OrderTable
from app.models.order import SellerOrder
from app.services.reconciliation_rules import AllocationRecord
from app.services.retention_access import require_retained_record


def check_and_apply_expiry(record: Any, now: datetime.datetime) -> bool:
    require_retained_record(record)
    if isinstance(record, OrderTable):
        if record.lifecycle == "awaiting_buyer" and now >= record.expires_at:
            record.lifecycle = "expired"
            record.completed_at = record.expires_at
            record.updated_at = now
            record.version = int(record.version) + 1
            return True
        return False
    elif isinstance(record, dict):
        if record.get("lifecycle") == "awaiting_buyer":
            expires_at = record.get("expires_at")
            if expires_at and now >= expires_at:
                record["lifecycle"] = "expired"
                record["completed_at"] = expires_at
                record["updated_at"] = now
                record["version"] = int(record.get("version", 1)) + 1
                return True
    return False


def to_seller_order(
    row: OrderTable,
    alloc: Optional[AllocationRecord] = None,
    review_reasons: Optional[List[str]] = None,
) -> SellerOrder:
    require_retained_record(row)
    decrypted_token = decrypt_token(row.encrypted_portal_token)
    actual_cod = (
        (int(row.total_minor) - alloc.accepted_amount_minor)
        if (row.lifecycle in ("confirmed", "cancelled") and alloc)
        else None
    )
    basis = alloc.basis if (row.lifecycle in ("confirmed", "cancelled") and alloc) else None
    return SellerOrder(
        id=str(row.id),
        shop_id=str(row.shop_id),
        payment_account_id=str(row.payment_account_id),
        product_name=str(row.product_name),
        total_minor=int(row.total_minor),
        required_advance_minor=int(row.required_advance_minor),
        expected_cod_minor=int(row.total_minor) - int(row.required_advance_minor),
        actual_cod_minor=actual_cod,
        account_provider=str(row.account_provider),
        account_receiving_number=str(row.account_receiving_number),
        account_label=str(row.account_label),
        lifecycle=str(row.lifecycle),  # type: ignore[arg-type]
        version=int(row.version),
        review_reasons=review_reasons or [],
        buyer_revision=row.buyer_revision,
        allocation_basis=basis,
        portal_token=decrypted_token,
        portal_url=f"/orders/{decrypted_token}",
        created_at=row.created_at,
        updated_at=row.updated_at,
        expires_at=row.expires_at,
        completed_at=row.completed_at,
        predecessor_order_id=getattr(row, "predecessor_order_id", None),
        replaced_by_order_id=getattr(row, "replaced_by_order_id", None),
    )


def to_seller_order_from_dict(
    raw: dict[str, Any],
    alloc: Optional[AllocationRecord] = None,
    review_reasons: Optional[List[str]] = None,
) -> SellerOrder:
    require_retained_record(raw)
    d = dict(raw)
    d["actual_cod_minor"] = (
        (int(raw["total_minor"]) - alloc.accepted_amount_minor)
        if (raw.get("lifecycle") in ("confirmed", "cancelled") and alloc)
        else None
    )
    d["allocation_basis"] = (
        alloc.basis if (raw.get("lifecycle") in ("confirmed", "cancelled") and alloc) else None
    )
    d["review_reasons"] = review_reasons or []
    return SellerOrder(**d)
