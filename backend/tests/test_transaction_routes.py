import uuid
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


@pytest.mark.asyncio
async def test_manual_transaction_creation_and_fields(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    acc_id = setup["account_id"]

    payload = {
        "payment_account_id": acc_id,
        "provider": "bkash",
        "trx_id": " 9K72LKQW1 ",
        "amount_minor": 15000,
        "sender_number": "০১৭৯৯৯৯৮৮৭৭",  # Bangla digits
        "occurred_at": "2026-10-24T00:00:00Z",
    }

    res = await seller_client.post("/api/seller/transactions", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["trx_id"] == "9K72LKQW1"  # Trimmed
    assert data["provider"] == "bkash"
    assert data["amount_minor"] == 15000
    assert data["sender_number_canonical"] == "01799998877"
    assert data["reconciliation_state"] == "unmatched"
    assert data["has_conflict"] is False
    assert len(data["observations"]) == 1

    obs = data["observations"][0]
    assert obs["source"] == "manual"
    assert obs["parse_state"] == "valid"
    assert obs["conflict_state"] == "none"
    assert obs["amount_minor"] == 15000


@pytest.mark.asyncio
async def test_manual_transaction_missing_sender_or_time_marked_incomplete(
    seller_client: AsyncClient,
) -> None:
    setup = await _setup_shop_and_account(seller_client)
    acc_id = setup["account_id"]

    payload = {
        "payment_account_id": acc_id,
        "provider": "bkash",
        "trx_id": "INCOMPLETETRX",
        "amount_minor": 20000,
        "sender_number": None,
        "occurred_at": None,
    }

    res = await seller_client.post("/api/seller/transactions", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["sender_number_raw"] is None
    assert data["sender_number_canonical"] is None
    assert data["occurred_at"] is None
    assert data["observations"][0]["parse_state"] == "incomplete"


@pytest.mark.asyncio
async def test_manual_transaction_invalid_inputs(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    acc_id = setup["account_id"]

    # Negative amount
    res1 = await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "bkash",
            "trx_id": "TRXNEG",
            "amount_minor": -500,
        },
    )
    assert res1.status_code == 422

    # Zero amount
    res2 = await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "bkash",
            "trx_id": "TRXZERO",
            "amount_minor": 0,
        },
    )
    assert res2.status_code == 422

    # Blank TrxID
    res3 = await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "bkash",
            "trx_id": "   ",
            "amount_minor": 1000,
        },
    )
    assert res3.status_code == 422

    # Invalid sender number
    res4 = await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "bkash",
            "trx_id": "TRXINVPHONE",
            "amount_minor": 1000,
            "sender_number": "12345",
        },
    )
    assert res4.status_code == 422


@pytest.mark.asyncio
async def test_manual_transaction_provider_mismatch(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    acc_id = setup["account_id"]

    # Account is bKash, but payload specifies nagad
    res = await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_id,
            "provider": "nagad",
            "trx_id": "TRXMISMATCH",
            "amount_minor": 1000,
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_manual_transaction_foreign_account_returns_404(
    seller_client: AsyncClient, second_seller_client: AsyncClient
) -> None:
    setup_b = await _setup_shop_and_account(second_seller_client, display_name="Shop B")
    acc_b_id = setup_b["account_id"]

    # Seller A tries to use Seller B's payment account
    await _setup_shop_and_account(seller_client, display_name="Shop A")
    res = await seller_client.post(
        "/api/seller/transactions",
        json={
            "payment_account_id": acc_b_id,
            "provider": "bkash",
            "trx_id": "TRXFOREIGN",
            "amount_minor": 1000,
        },
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_identical_observation_is_noop_for_payment_value(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    acc_id = setup["account_id"]

    payload = {
        "payment_account_id": acc_id,
        "provider": "bkash",
        "trx_id": "REPEATTRX1",
        "amount_minor": 25000,
        "sender_number": "01711223344",
        "occurred_at": "2026-10-24T12:00:00Z",
    }

    res1 = await seller_client.post("/api/seller/transactions", json=payload)
    assert res1.status_code == 201

    # Second entry with different request / no idempotency key
    res2 = await seller_client.post("/api/seller/transactions", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()

    assert data2["amount_minor"] == 25000
    assert data2["has_conflict"] is False
    assert data2["reconciliation_state"] == "unmatched"
    assert len(data2["observations"]) == 2
    assert data2["observations"][1]["conflict_state"] == "identical"


@pytest.mark.asyncio
async def test_contradictory_observation_sets_conflict_state(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    acc_id = setup["account_id"]

    payload1 = {
        "payment_account_id": acc_id,
        "provider": "bkash",
        "trx_id": "CONFLICTTRX1",
        "amount_minor": 30000,
        "sender_number": "01711223344",
        "occurred_at": "2026-10-24T12:00:00Z",
    }
    res1 = await seller_client.post("/api/seller/transactions", json=payload1)
    assert res1.status_code == 201

    # Contradictory entry: same TrxID, but different amount!
    payload2 = {
        "payment_account_id": acc_id,
        "provider": "bkash",
        "trx_id": "CONFLICTTRX1",
        "amount_minor": 50000,  # Contradictory amount!
        "sender_number": "01711223344",
        "occurred_at": "2026-10-24T12:00:00Z",
    }
    res2 = await seller_client.post("/api/seller/transactions", json=payload2)
    assert res2.status_code == 200
    data2 = res2.json()

    assert data2["has_conflict"] is True
    assert data2["reconciliation_state"] == "conflicted"
    # Original amount is not silently overwritten
    assert data2["amount_minor"] == 30000
    assert len(data2["observations"]) == 2
    assert data2["observations"][1]["conflict_state"] == "conflicting"
    assert data2["observations"][1]["amount_minor"] == 50000


@pytest.mark.asyncio
async def test_idempotency_key_replay_and_conflict(seller_client: AsyncClient) -> None:
    setup = await _setup_shop_and_account(seller_client)
    acc_id = setup["account_id"]

    payload = {
        "payment_account_id": acc_id,
        "provider": "bkash",
        "trx_id": "IDEMPTRX",
        "amount_minor": 12000,
    }
    idem_key = str(uuid.uuid4())

    res1 = await seller_client.post(
        "/api/seller/transactions", json=payload, headers={"Idempotency-Key": idem_key}
    )
    assert res1.status_code == 201
    orig_data = res1.json()

    # Replay with same key & payload -> identical response
    res2 = await seller_client.post(
        "/api/seller/transactions", json=payload, headers={"Idempotency-Key": idem_key}
    )
    assert res2.status_code == 201
    assert res2.json() == orig_data

    # Replay with same key & different payload -> 409 IDEMPOTENCY_KEY_REUSED
    diff_payload = {**payload, "amount_minor": 99999}
    res3 = await seller_client.post(
        "/api/seller/transactions", json=diff_payload, headers={"Idempotency-Key": idem_key}
    )
    assert res3.status_code == 409
    assert res3.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"


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

