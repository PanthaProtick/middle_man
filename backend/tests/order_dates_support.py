"""Bangladesh creation-date filtering for the seller list and CSV export."""
import datetime

from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.tokens import get_utc_now
from app.main import app
from app.services.order_service import _memory_orders
from app.services.seller_service import _memory_shops

DHAKA = datetime.timezone(datetime.timedelta(hours=6))
UTC = datetime.timezone.utc


def _utc(year: int, month: int, day: int, hour: int = 0, minute: int = 0,
         second: int = 0, microsecond: int = 0) -> datetime.datetime:
    return datetime.datetime(year, month, day, hour, minute, second, microsecond, tzinfo=UTC)


async def _setup_shop(client: AsyncClient, owner_id: str = "date-owner") -> tuple[str, str]:
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id=owner_id)
    await client.post(
        "/api/seller/shop",
        json={"display_name": f"Shop {owner_id}"},
        headers={"Idempotency-Key": f"shop-{owner_id}"},
    )
    account = await client.post(
        "/api/seller/payment-accounts",
        json={"provider": "bkash", "receiving_number": "01733445566", "label": "Date account"},
        headers={"Idempotency-Key": f"account-{owner_id}"},
    )
    shop_id = next(
        shop["id"] for shop in _memory_shops.values() if shop["owner_id"] == owner_id
    )
    return shop_id, account.json()["id"]


def _seed_order(
    shop_id: str,
    account_id: str,
    order_id: str,
    created_at: datetime.datetime,
    *,
    product_name: str = "Dated order",
    lifecycle: str = "awaiting_buyer",
) -> None:
    now = get_utc_now()
    _memory_orders[order_id] = {
        "id": order_id,
        "shop_id": shop_id,
        "payment_account_id": account_id,
        "product_name": product_name,
        "total_minor": 10000,
        "required_advance_minor": 2000,
        "expected_cod_minor": 8000,
        "actual_cod_minor": None,
        "account_provider": "bkash",
        "account_receiving_number": "01733445566",
        "account_label": "Date account",
        "lifecycle": lifecycle,
        "version": 1,
        "buyer_revision": None,
        "portal_token": f"token-{order_id}",
        "portal_url": f"/orders/token-{order_id}",
        "created_at": created_at,
        "updated_at": now,
        "expires_at": now + datetime.timedelta(days=2),
        "completed_at": None,
    }


async def _ids(client: AsyncClient, **params: str) -> list[str]:
    response = await client.get("/api/seller/orders", params=params)
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["items"]]
