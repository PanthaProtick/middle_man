import uuid

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
