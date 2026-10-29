import pytest
from httpx import AsyncClient

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store


@pytest.fixture(autouse=True)
def clean_stores() -> None:
    reset_memory_store()
    reset_order_memory_store()


@pytest.mark.asyncio
async def test_list_orders_filtering_and_pagination(client: AsyncClient) -> None:
    seller = SellerIdentity(owner_id="seller_page_test")
    app.dependency_overrides[get_seller_identity] = lambda: seller
    try:
        await client.post("/api/seller/shop", json={"display_name": "Page Shop"}, headers={"Idempotency-Key": "k-p1"})
        acc = await client.post(
            "/api/seller/payment-accounts",
            json={"provider": "bkash", "receiving_number": "01799887766", "label": "Page Acc"},
            headers={"Idempotency-Key": "k-p2"},
        )
        acc_id = acc.json()["id"]

        # Create 3 orders
        for i in range(1, 4):
            await client.post(
                "/api/seller/orders",
                json={
                    "product_name": f"Product {i}",
                    "total_minor": 100000 * i,
                    "required_advance_minor": 20000 * i,
                    "payment_account_id": acc_id,
                },
                headers={"Idempotency-Key": f"k-p-ord-{i}"},
            )

        # List with limit 2
        resp = await client.get("/api/seller/orders?limit=2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["next_cursor"] is not None

        # Fetch next page using cursor
        cursor = data["next_cursor"]
        resp_next = await client.get(f"/api/seller/orders?limit=2&cursor={cursor}")
        assert resp_next.status_code == 200
        data_next = resp_next.json()
        assert len(data_next["items"]) == 1
        assert data_next["next_cursor"] is None

        # Filter by status
        resp_filtered = await client.get("/api/seller/orders?status=awaiting_buyer")
        assert resp_filtered.status_code == 200
        assert len(resp_filtered.json()["items"]) == 3

        resp_expired = await client.get("/api/seller/orders?status=expired")
        assert resp_expired.status_code == 200
        assert len(resp_expired.json()["items"]) == 0

    finally:
        app.dependency_overrides.pop(get_seller_identity, None)
