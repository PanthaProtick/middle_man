"""Current link authority must be checked before work or cached replay."""
from typing import Any

from app.models.entities import OrderTable
from app.services.retention_access import require_retained_record
from app.services.seller_service import SellerDomainException


def require_public_order_access(record: OrderTable | dict[str, Any]) -> None:
    require_retained_record(record)
    revoked = record.buyer_link_revoked_at if isinstance(record, OrderTable) else record.get("buyer_link_revoked_at")
    if revoked:
        raise SellerDomainException(410, "BUYER_LINK_REVOKED", "Buyer link access has been revoked. Contact the seller.")
