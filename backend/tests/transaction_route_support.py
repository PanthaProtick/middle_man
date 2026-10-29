from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.order_service import reset_order_memory_store
from app.services.seller_service import reset_memory_store
from app.services.transaction_store import reset_transaction_memory_store


@pytest.fixture(autouse=True)
def clean_stores() -> None:
    reset_memory_store()
    reset_order_memory_store()
    reset_transaction_memory_store()


@pytest.fixture
async def seller_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": "Bearer mock-seller-token"},
    ) as client:
        yield client


@pytest.fixture
async def second_seller_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": "Bearer dev-second-seller"},
    ) as client:
        yield client


async def _setup_shop_and_account(
    client: AsyncClient, display_name: str = "Test Shop", receiving_number: str = "01711111111"
) -> dict[str, str]:
    shop_res = await client.post("/api/seller/shop", json={"display_name": display_name})
    assert shop_res.status_code in (200, 201)
    shop_id = shop_res.json()["shop"]["id"]

    acc_res = await client.post(
        "/api/seller/payment-accounts",
        json={
            "provider": "bkash",
            "receiving_number": receiving_number,
            "label": "Primary bKash",
        },
    )
    assert acc_res.status_code in (200, 201)
    acc_id = acc_res.json()["id"]

    return {"shop_id": shop_id, "account_id": acc_id}
