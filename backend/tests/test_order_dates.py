"""Bangladesh creation-date filtering for the seller list and CSV export."""
import datetime

import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.core.tokens import get_utc_now
from app.main import app
from app.services.order_dates import order_created_bounds, within_order_dates
from app.services.order_export import _memory_attempts
from app.services.order_service import _memory_orders, reset_order_memory_store
from app.services.seller_service import _memory_shops, reset_memory_store

DHAKA = datetime.timezone(datetime.timedelta(hours=6))
UTC = datetime.timezone.utc


def _utc(year: int, month: int, day: int, hour: int = 0, minute: int = 0,
         second: int = 0, microsecond: int = 0) -> datetime.datetime:
    return datetime.datetime(year, month, day, hour, minute, second, microsecond, tzinfo=UTC)


@pytest.fixture(autouse=True)
def clean_date_state():
    reset_memory_store()
    reset_order_memory_store()
    _memory_attempts.clear()
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(get_seller_identity, None)
    app.dependency_overrides.pop(verify_public_access_gate, None)


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


def test_order_created_bounds_convert_dhaka_calendar_days_to_utc():
    start, end = order_created_bounds(datetime.date(2026, 10, 28), datetime.date(2026, 10, 28))
    assert start == _utc(2026, 10, 27, 18)
    assert end == _utc(2026, 10, 28, 18)

    open_start, open_end = order_created_bounds(None, None)
    assert open_start is None
    assert open_end is None


def test_order_created_bounds_accept_future_end_and_reject_reversed_range():
    start, end = order_created_bounds(datetime.date(2026, 10, 28), datetime.date(2099, 1, 1))
    assert start == _utc(2026, 10, 27, 18)
    assert end == _utc(2099, 1, 1, 18)

    with pytest.raises(Exception) as raised:
        order_created_bounds(datetime.date(2026, 10, 29), datetime.date(2026, 10, 28))
    assert getattr(raised.value, "status_code", None) == 422
    assert raised.value.detail["code"] == "INVALID_DATE_RANGE"


def test_within_order_dates_is_inclusive_at_start_and_exclusive_at_end():
    start = _utc(2026, 10, 27, 18)
    end = _utc(2026, 10, 28, 18)

    assert within_order_dates(start, start, end) is True
    assert within_order_dates(end - datetime.timedelta(milliseconds=1), start, end) is True
    assert within_order_dates(end, start, end) is False
    assert within_order_dates(start - datetime.timedelta(milliseconds=1), start, end) is False
    assert within_order_dates(datetime.datetime(2026, 10, 27, 18), start, end) is True


@pytest.mark.asyncio
async def test_order_date_filter_uses_dhaka_midnight_and_includes_both_endpoints(
    client: AsyncClient,
):
    shop_id, account_id = await _setup_shop(client)
    _seed_order(shop_id, account_id, "before-day", _utc(2026, 10, 27, 17, 59, 59, 999000))
    _seed_order(shop_id, account_id, "day-start", _utc(2026, 10, 27, 18))
    _seed_order(shop_id, account_id, "day-end", _utc(2026, 10, 28, 17, 59, 59, 999000))
    _seed_order(shop_id, account_id, "after-day", _utc(2026, 10, 28, 18))

    assert set(await _ids(client, from_date="2026-10-28", to_date="2026-10-28")) == {
        "day-start",
        "day-end",
    }
    assert await _ids(client, from_date="2026-10-29", to_date="2026-10-29") == ["after-day"]
    assert await _ids(client, from_date="2026-10-27", to_date="2026-10-27") == ["before-day"]


@pytest.mark.asyncio
async def test_order_date_filter_supports_open_bounds_and_future_end_dates(client: AsyncClient):
    shop_id, account_id = await _setup_shop(client)
    _seed_order(shop_id, account_id, "older", _utc(2026, 10, 1, 6))
    _seed_order(shop_id, account_id, "day-start", _utc(2026, 10, 27, 18))
    _seed_order(shop_id, account_id, "newer", _utc(2026, 11, 1, 6))

    assert set(await _ids(client, from_date="2026-10-28")) == {"day-start", "newer"}
    assert set(await _ids(client, to_date="2026-10-28")) == {"older", "day-start"}
    assert set(
        await _ids(client, from_date="2026-10-28", to_date="2099-12-31")
    ) == {"day-start", "newer"}


@pytest.mark.asyncio
async def test_order_date_filter_rejects_reversed_and_malformed_dates(client: AsyncClient):
    await _setup_shop(client)

    reversed_list = await client.get(
        "/api/seller/orders", params={"from_date": "2026-10-29", "to_date": "2026-10-28"}
    )
    assert reversed_list.status_code == 422
    assert reversed_list.json()["error"]["code"] == "INVALID_DATE_RANGE"

    reversed_export = await client.get(
        "/api/seller/orders/export",
        params={"from_date": "2026-10-29", "to_date": "2026-10-28"},
    )
    assert reversed_export.status_code == 422
    assert reversed_export.json()["error"]["code"] == "INVALID_DATE_RANGE"

    for path in ("/api/seller/orders", "/api/seller/orders/export"):
        malformed = await client.get(path, params={"from_date": "2026-13-01"})
        assert malformed.status_code == 422
        assert malformed.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_order_date_filter_combines_with_search_lifecycle_and_paginates_after_filtering(
    client: AsyncClient,
):
    shop_id, account_id = await _setup_shop(client)
    _seed_order(shop_id, account_id, "in-range-old", _utc(2026, 10, 27, 18, 1), product_name="Needle Alpha")
    _seed_order(shop_id, account_id, "in-range-new", _utc(2026, 10, 28, 17), product_name="Needle Beta")
    _seed_order(shop_id, account_id, "in-range-other", _utc(2026, 10, 28, 12), product_name="Not a match")
    _seed_order(shop_id, account_id, "out-of-range", _utc(2026, 10, 29, 21), product_name="Needle Outside")
    _seed_order(
        shop_id,
        account_id,
        "in-range-pending",
        _utc(2026, 10, 28, 13),
        product_name="Needle Pending",
        lifecycle="pending",
    )

    first = await client.get(
        "/api/seller/orders",
        params={
            "search": "needle",
            "status": "awaiting_buyer",
            "from_date": "2026-10-28",
            "to_date": "2026-10-28",
            "limit": 1,
        },
    )
    assert first.status_code == 200, first.text
    page = first.json()
    assert [item["id"] for item in page["items"]] == ["in-range-new"]
    assert page["next_cursor"] == "in-range-new"

    second = await client.get(
        "/api/seller/orders",
        params={
            "search": "needle",
            "status": "awaiting_buyer",
            "from_date": "2026-10-28",
            "to_date": "2026-10-28",
            "limit": 1,
            "cursor": page["next_cursor"],
        },
    )
    assert second.status_code == 200, second.text
    assert [item["id"] for item in second.json()["items"]] == ["in-range-old"]
    assert second.json()["next_cursor"] is None


@pytest.mark.asyncio
async def test_order_date_filter_excludes_retained_orders(client: AsyncClient):
    shop_id, account_id = await _setup_shop(client)
    _seed_order(shop_id, account_id, "retained", _utc(2026, 10, 28, 6), product_name="Retained Needle")
    _memory_orders["retained"]["retained_at"] = get_utc_now()

    assert await _ids(
        client,
        search="retained",
        from_date="2026-10-28",
        to_date="2026-10-28",
    ) == []


@pytest.mark.asyncio
async def test_order_export_applies_the_same_date_search_and_status_criteria(client: AsyncClient):
    shop_id, account_id = await _setup_shop(client)
    _seed_order(shop_id, account_id, "in-range-a", _utc(2026, 10, 28, 6), product_name="Dated Needle A")
    _seed_order(shop_id, account_id, "in-range-b", _utc(2026, 10, 28, 17), product_name="Dated Needle B")
    _seed_order(shop_id, account_id, "outside", _utc(2026, 10, 29, 6), product_name="Dated Needle Outside")
    _seed_order(
        shop_id,
        account_id,
        "pending",
        _utc(2026, 10, 28, 8),
        product_name="Dated Needle Pending",
        lifecycle="pending",
    )

    response = await client.get(
        "/api/seller/orders/export",
        params={
            "search": "needle",
            "status": "awaiting_buyer",
            "from_date": "2026-10-28",
            "to_date": "2026-10-28",
        },
    )
    assert response.status_code == 200, response.text
    assert response.headers["X-Export-Count"] == "2"
    assert "Dated Needle A" in response.text
    assert "Dated Needle B" in response.text
    assert "Outside" not in response.text
    assert "Pending" not in response.text
    assert "no-store" in response.headers["cache-control"]

    too_large = await client.get(
        "/api/seller/orders/export",
        params={
            "search": "needle",
            "status": "awaiting_buyer",
            "from_date": "2026-10-28",
            "to_date": "2026-10-28",
            "limit": 1,
        },
    )
    assert too_large.status_code == 422
    assert too_large.json()["error"]["code"] == "EXPORT_TOO_LARGE"

    outside_range = await client.get(
        "/api/seller/orders/export",
        params={"from_date": "2026-10-29", "to_date": "2026-10-29"},
    )
    assert outside_range.headers["X-Export-Count"] == "1"
    assert "Dated Needle Outside" in outside_range.text


@pytest.mark.asyncio
async def test_order_export_date_boundary_counts_only_rows_inside_the_range(client: AsyncClient):
    shop_id, account_id = await _setup_shop(client, "date-export-boundary")
    outside_created = _utc(2026, 10, 27, 17, 59, 59, 999000)
    inside_created = _utc(2026, 10, 28, 6)

    for index in range(20):
        _seed_order(
            shop_id,
            account_id,
            f"outside-{index:03d}",
            outside_created,
            product_name=f"Outside {index}",
        )
    for index in range(500):
        _seed_order(
            shop_id,
            account_id,
            f"inside-{index:03d}",
            inside_created,
            product_name=f"Inside {index}",
        )

    at_limit = await client.get(
        "/api/seller/orders/export",
        params={"from_date": "2026-10-28", "to_date": "2026-10-28"},
    )
    assert at_limit.status_code == 200, at_limit.text
    assert at_limit.headers["X-Export-Count"] == "500"

    _seed_order(shop_id, account_id, "inside-extra", inside_created, product_name="Inside extra")
    over_limit = await client.get(
        "/api/seller/orders/export",
        params={"from_date": "2026-10-28", "to_date": "2026-10-28"},
    )
    assert over_limit.status_code == 422
    assert over_limit.json()["error"]["code"] == "EXPORT_TOO_LARGE"
