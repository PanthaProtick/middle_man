
import pytest
from httpx import AsyncClient
from transaction_route_support import (  # noqa: F401
    _setup_shop_and_account,
)
from transaction_route_support import (
    clean_stores as clean_stores,
)
from transaction_route_support import (
    second_seller_client as second_seller_client,
)
from transaction_route_support import (
    seller_client as seller_client,
)

from app.main import app


@pytest.mark.asyncio
async def test_list_transactions_and_filtering(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    acc_id = setup["account_id"]

    # Create 3 transactions:
    # 1. Complete valid
    await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "bkash",
            "trx_id": "TX_VALID",
            "amount_minor": 10000,
            "sender_number": "01711111111",
            "occurred_at": "2026-10-24T10:00:00Z",
        },
    )
    # 2. Incomplete (no sender)
    await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "bkash",
            "trx_id": "TX_INCOMPLETE",
            "amount_minor": 20000,
            "sender_number": None,
            "occurred_at": "2026-10-24T10:05:00Z",
        },
    )
    # 3. Conflicted
    await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "bkash",
            "trx_id": "TX_CONFLICT",
            "amount_minor": 30000,
        },
    )
    await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "bkash",
            "trx_id": "TX_CONFLICT",
            "amount_minor": 40000,  # Contradiction
        },
    )

    # List all
    res_all = await seller_client.get("/api/seller/transactions")
    assert res_all.status_code == 200
    items_all = res_all.json()["items"]
    assert len(items_all) == 3

    # Filter review=conflicted
    res_conf = await seller_client.get("/api/seller/transactions?review=conflicted")
    assert res_conf.status_code == 200
    items_conf = res_conf.json()["items"]
    assert len(items_conf) == 1
    assert items_conf[0]["trx_id"] == "TX_CONFLICT"

    # Filter review=incomplete
    res_inc = await seller_client.get("/api/seller/transactions?review=incomplete")
    assert res_inc.status_code == 200
    items_inc = res_inc.json()["items"]
    assert len(items_inc) == 2  # TX_INCOMPLETE and TX_CONFLICT (both have missing sender/time)


@pytest.mark.asyncio
async def test_shop_isolation_transactions(
    seller_client: AsyncClient, second_seller_client: AsyncClient
) -> None:
    setup_a = await _setup_shop_and_account(seller_client, display_name="Shop A")
    await _setup_shop_and_account(second_seller_client, display_name="Shop B")

    await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": setup_a["account_id"],
            "provider": "bkash",
            "trx_id": "SHOP_A_TRX",
            "amount_minor": 50000,
        },
    )

    # Shop B listing transactions should not see Shop A's transactions
    res_b = await second_seller_client.get("/api/seller/transactions")
    assert res_b.status_code == 200
    items_b = res_b.json()["items"]
    assert len(items_b) == 0


@pytest.mark.asyncio
async def test_buyer_portal_projection_does_not_leak_received_transactions(
    seller_client: AsyncClient,
) -> None:
    from app.core.public_gate import allow_synthetic_buyer_demo, verify_public_access_gate

    app.dependency_overrides[verify_public_access_gate] = allow_synthetic_buyer_demo
    try:
        setup = await _setup_shop_and_account(seller_client, display_name="Privacy Shop")

        # Create an order
        order_res = await seller_client.post(
            "/api/seller/orders",
            json={
                "product_name": "Test Gadget",
                "total_minor": 100000,
                "required_advance_minor": 20000,
                "payment_account_id": setup["account_id"],
            },
        )
        assert order_res.status_code == 201
        portal_url = order_res.json()["portal_url"]
        portal_token = portal_url.split("/")[-1]

        # Record private received transactions
        await seller_client.post(
            "/api/seller/transactions",
            json={
                "payment_account_id": setup["account_id"],
                "provider": "bkash",
                "trx_id": "SECRET_TRX_999",
                "amount_minor": 20000,
                "sender_number": "01712345678",
                "occurred_at": "2026-10-24T12:00:00Z",
            },
        )

        # Public buyer portal read
        buyer_res = await seller_client.get(f"/api/public/orders/{portal_token}")
        assert buyer_res.status_code == 200
        buyer_data = buyer_res.json()

        # Verify no transaction, observation or secret details are exposed
        buyer_json_str = str(buyer_data)
        assert "SECRET_TRX_999" not in buyer_json_str
        assert "01712345678" not in buyer_json_str
        assert "observations" not in buyer_data
        assert "transactions" not in buyer_data
    finally:
        app.dependency_overrides.pop(verify_public_access_gate, None)
