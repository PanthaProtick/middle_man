"""Bangladesh creation-date filtering for the seller list."""
import datetime

import pytest
from httpx import AsyncClient

from app.core.auth import get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.core.tokens import get_utc_now
from app.main import app
from app.services.order_dates import order_created_bounds, within_order_dates
from app.services.order_export import _memory_attempts
from app.services.order_service import _memory_orders, reset_order_memory_store
from app.services.seller_service import reset_memory_store
from tests.order_dates_support import _ids, _seed_order, _setup_shop, _utc


@pytest.fixture(autouse=True)
def clean_date_state():
    reset_memory_store()
    reset_order_memory_store()
    _memory_attempts.clear()
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(get_seller_identity, None)
    app.dependency_overrides.pop(verify_public_access_gate, None)


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
