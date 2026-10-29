
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
