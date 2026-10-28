import datetime
import uuid

import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate
from app.core.tokens import get_utc_now
from app.main import app
from app.services.order_service import _memory_orders, reset_order_memory_store
from app.services.seller_service import reset_memory_store


@pytest.fixture(autouse=True)
def clean_search_state():
    reset_memory_store()
    reset_order_memory_store()
    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    yield
    app.dependency_overrides.pop(get_seller_identity, None)
    app.dependency_overrides.pop(verify_public_access_gate, None)


async def _setup_shop(client: AsyncClient, owner_id: str = "search-owner") -> str:
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id=owner_id)
    await client.post(
        "/api/seller/shop",
        json={"display_name": f"Shop {owner_id}"},
        headers={"Idempotency-Key": f"shop-{owner_id}"},
    )
    account = await client.post(
        "/api/seller/payment-accounts",
        json={"provider": "bkash", "receiving_number": "01733445566", "label": "Search account"},
        headers={"Idempotency-Key": f"account-{owner_id}"},
    )
    return account.json()["id"]


async def _create_order(client: AsyncClient, account_id: str, product_name: str, key: str) -> dict:
    response = await client.post(
        "/api/seller/orders",
        json={
            "product_name": product_name,
            "total_minor": 100000,
            "required_advance_minor": 20000,
            "payment_account_id": account_id,
        },
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _submit_buyer(
    client: AsyncClient,
    order: dict,
    *,
    name: str = "Rahim Uddin",
    contact: str = "+880 1711-111111",
    key: str = "buyer-submit",
) -> None:
    response = await client.post(
        f"/api/public/orders/{order['portal_token']}/submission",
        json={
            "buyer_name": name,
            "contact_number": contact,
            "address": {"raw_text": "Synthetic address, Dhaka"},
            "payment_claim": {
                "provider": "bkash",
                "trx_id": f"TRX-{uuid.uuid4().hex[:12]}",
                "sender_number": contact,
                "amount_minor": 20000,
            },
        },
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 200, response.text


async def _ids(client: AsyncClient, **params: str) -> list[str]:
    response = await client.get("/api/seller/orders", params=params)
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["items"]]


@pytest.mark.asyncio
async def test_order_search_matches_identifier_product_buyer_and_full_phone(client: AsyncClient):
    account_id = await _setup_shop(client)
    keyboard = await _create_order(client, account_id, "Vintage Mechanical Keyboard", "search-order-1")
    await _create_order(client, account_id, "Leather Backpack", "search-order-2")
    await _submit_buyer(client, keyboard)

    assert await _ids(client, search=f"  {keyboard['id'].upper()}  ") == [keyboard["id"]]
    assert await _ids(client, search="MeChAnIcAl") == [keyboard["id"]]
    assert await _ids(client, search="rahim") == [keyboard["id"]]
    assert await _ids(client, search="+880 1711-111111") == [keyboard["id"]]
    assert await _ids(client, search="8801711111111") == [keyboard["id"]]
    assert await _ids(client, search="০১৭" + "১" * 8) == [keyboard["id"]]
    assert await _ids(client, search="0171") == []
    assert await _ids(client, search=keyboard["id"][:8]) == []
    assert await _ids(client, search="missing value") == []

    response = await client.get("/api/seller/orders", params={"search": "   "})
    assert len(response.json()["items"]) == 2


@pytest.mark.asyncio
async def test_order_search_combines_with_lifecycle_and_stays_shop_scoped(client: AsyncClient):
    account_a = await _setup_shop(client, "search-a")
    pending = await _create_order(client, account_a, "Shared Widget Alpha", "a-1")
    awaiting = await _create_order(client, account_a, "Shared Widget Beta", "a-2")
    await _submit_buyer(client, pending)

    account_b = await _setup_shop(client, "search-b")
    foreign = await _create_order(client, account_b, "Shared Widget Foreign", "b-1")

    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="search-a")
    assert await _ids(client, search="shared widget", status="pending") == [pending["id"]]
    assert await _ids(client, search="shared widget", status="awaiting_buyer") == [awaiting["id"]]
    assert set(await _ids(client, search="shared widget")) == {pending["id"], awaiting["id"]}
    assert foreign["id"] not in await _ids(client, search="shared widget")


@pytest.mark.asyncio
async def test_order_search_filters_before_pagination(client: AsyncClient):
    account_id = await _setup_shop(client)
    match = await _create_order(client, account_id, "Needle in the stack", "page-1")
    await _create_order(client, account_id, "Unrelated newest", "page-2")
    await _create_order(client, account_id, "Unrelated newer", "page-3")
    await _create_order(client, account_id, "Unrelated new", "page-4")

    response = await client.get("/api/seller/orders", params={"search": "needle", "limit": 1})
    data = response.json()
    assert [item["id"] for item in data["items"]] == [match["id"]]
    assert data["next_cursor"] is None

    await _create_order(client, account_id, "Needle second", "page-5")
    await _create_order(client, account_id, "Needle third", "page-6")
    first = (await client.get("/api/seller/orders", params={"search": "needle", "limit": 2})).json()
    assert len(first["items"]) == 2
    assert first["next_cursor"] is not None
    second = (await client.get(
        "/api/seller/orders",
        params={"search": "needle", "limit": 2, "cursor": first["next_cursor"]},
    )).json()
    assert [item["id"] for item in second["items"]][-1] == match["id"]
    assert second["next_cursor"] is None


@pytest.mark.asyncio
async def test_order_search_excludes_retained_orders(client: AsyncClient):
    account_id = await _setup_shop(client)
    order = await _create_order(client, account_id, "Retained Needle", "retained-1")
    _memory_orders[order["id"]]["retained_at"] = get_utc_now()

    assert await _ids(client, search="retained needle") == []


@pytest.mark.asyncio
async def test_order_export_uses_search_and_rejects_more_than_limit(client: AsyncClient):
    account_id = await _setup_shop(client)
    report = await _create_order(client, account_id, "Report Match", "export-1")
    await _create_order(client, account_id, "Other One", "export-2")
    await _create_order(client, account_id, "Other Two", "export-3")

    response = await client.get("/api/seller/orders/export", params={"search": "report"})
    assert response.status_code == 200
    assert response.headers["X-Export-Count"] == "1"
    assert "Report Match" in response.text
    assert "Other One" not in response.text
    assert "no-store" in response.headers["cache-control"]

    everything = await client.get("/api/seller/orders/export", params={"search": "other"})
    assert everything.headers["X-Export-Count"] == "2"

    too_large = await client.get("/api/seller/orders/export", params={"search": "other", "limit": 1})
    assert too_large.status_code == 422
    assert too_large.json()["error"]["code"] == "EXPORT_TOO_LARGE"

    empty = await client.get("/api/seller/orders/export", params={"search": "nothing matches"})
    assert empty.status_code == 200
    assert empty.headers["X-Export-Count"] == "0"

    await _submit_buyer(client, report, key="export-buyer")
    awaiting = await client.get(
        "/api/seller/orders/export",
        params={"search": "report", "status": "awaiting_buyer"},
    )
    assert awaiting.status_code == 200
    assert awaiting.headers["X-Export-Count"] == "0"
    pending = await client.get(
        "/api/seller/orders/export",
        params={"search": "report", "status": "pending"},
    )
    assert pending.status_code == 200
    assert pending.headers["X-Export-Count"] == "1"


def _seed_orders(shop_id: str, account_id: str, count: int, matching: int) -> None:
    now = get_utc_now()
    for index in range(count):
        order_id = f"seed-{index:04d}"
        product = "Only Export Needle" if index < matching else f"Seed Product {index}"
        _memory_orders[order_id] = {
            "id": order_id,
            "shop_id": shop_id,
            "payment_account_id": account_id,
            "product_name": product,
            "total_minor": 10000,
            "required_advance_minor": 2000,
            "expected_cod_minor": 8000,
            "actual_cod_minor": None,
            "account_provider": "bkash",
            "account_receiving_number": "01733445566",
            "account_label": "Search account",
            "lifecycle": "awaiting_buyer",
            "version": 1,
            "buyer_revision": None,
            "created_at": now + datetime.timedelta(seconds=index),
            "updated_at": now,
            "expires_at": now + datetime.timedelta(days=1),
            "completed_at": None,
        }


@pytest.mark.asyncio
async def test_order_export_boundary_is_five_hundred_rows(client: AsyncClient):
    account_id = await _setup_shop(client, "export-boundary")
    from app.services.seller_service import _memory_shops

    shop_id = next(shop["id"] for shop in _memory_shops.values() if shop["owner_id"] == "export-boundary")
    _seed_orders(shop_id, account_id, 500, matching=0)
    at_limit = await client.get("/api/seller/orders/export")
    assert at_limit.status_code == 200
    assert at_limit.headers["X-Export-Count"] == "500"

    _seed_orders(shop_id, account_id, 501, matching=1)
    over_limit = await client.get("/api/seller/orders/export")
    assert over_limit.status_code == 422
    assert over_limit.json()["error"]["code"] == "EXPORT_TOO_LARGE"

    narrowed = await client.get("/api/seller/orders/export", params={"search": "export needle"})
    assert narrowed.status_code == 200
    assert narrowed.headers["X-Export-Count"] == "1"


@pytest.mark.asyncio
async def test_order_search_rejects_overlong_terms(client: AsyncClient):
    await _setup_shop(client)
    response = await client.get("/api/seller/orders", params={"search": "x" * 201})
    assert response.status_code == 422
    export = await client.get("/api/seller/orders/export", params={"search": "x" * 201})
    assert export.status_code == 422
