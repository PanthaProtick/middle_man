"""CSV date criteria and export count boundaries."""
import pytest
from httpx import AsyncClient

from app.core.auth import get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.main import app
from app.services.order_export import _memory_attempts
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store
from tests.order_dates_support import _seed_order, _setup_shop, _utc


@pytest.fixture(autouse=True)
def clean_date_state():
    reset_memory_store()
    reset_order_memory_store()
    _memory_attempts.clear()
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(get_seller_identity, None)
    app.dependency_overrides.pop(verify_public_access_gate, None)


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
