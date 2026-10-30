import datetime

import pytest
from httpx import AsyncClient
from review_assistance_support import (
    OTHER_SENDER,
    claim_submitted_at,
    create_order,
    record_receipt,
    submit_claim,
)
from test_public_order_routes import _create_test_order
from test_review_assistance_api import clean_stores, seller_identity  # noqa: F401

pytestmark = pytest.mark.usefixtures("seller_identity")


async def request_advice(client: AsyncClient, order: dict, **payload) -> dict:
    response = await client.post(f"/api/seller/orders/{order['id']}/review-assistance", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def actions(data: dict) -> list[str]:
    return [item["action_id"] for item in data["suggested_actions"]]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("sender", "status"),
    [(None, "missing"), (OTHER_SENDER, "different")],
)
async def test_sender_mismatch_distinguishes_missing_and_different(
    client: AsyncClient, sender, status,
):
    order = await _create_test_order(client)
    await submit_claim(client, order)
    await record_receipt(
        client, order=order, sender=sender, key=f"sender-{status}",
        occurred_at=datetime.datetime.fromisoformat(order["created_at"]),
    )

    data = await request_advice(client, order)
    assert data["condition"] == "SENDER_MISMATCH"
    assert data["reason_codes"] == ["SENDER_MISMATCH"]
    assert data["facts"] == {"has_matching_receipt": True, "sender_status": status}
    assert actions(data) == ["CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS"]
    expected = "no sender number" if status == "missing" else "different from the sender number"
    assert expected in data["explanation"]


@pytest.mark.asyncio
async def test_amount_mismatch_reports_only_amounts_and_currency(client: AsyncClient):
    order = await _create_test_order(client)
    await submit_claim(client, order)
    await record_receipt(
        client, order=order, amount_minor=150_000, key="amount",
        occurred_at=datetime.datetime.fromisoformat(order["created_at"]),
    )

    data = await request_advice(client, order)
    assert data["condition"] == "AMOUNT_MISMATCH"
    assert data["facts"] == {
        "has_matching_receipt": True,
        "required_advance_minor": 200_000,
        "claimed_amount_minor": 200_000,
        "received_amount_minor": 150_000,
        "currency": "BDT",
    }
    assert "BDT 2,000.00" in data["explanation"]
    assert "BDT 1,500.00" in data["explanation"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("when", "status"),
    [
        ("missing", "missing"),
        ("before", "before_order_creation"),
        ("after", "after_claim_submission"),
    ],
)
async def test_time_unclear_distinguishes_missing_before_and_after(
    client: AsyncClient, when, status,
):
    order = await _create_test_order(client)
    await submit_claim(client, order)
    created = datetime.datetime.fromisoformat(order["created_at"])
    occurred_at = {
        "missing": None,
        "before": created - datetime.timedelta(hours=1),
        "after": claim_submitted_at(order["id"]) + datetime.timedelta(hours=1),
    }[when]
    await record_receipt(
        client, order=order, key=f"time-{when}", occurred_at=occurred_at,
    )

    data = await request_advice(client, order)
    assert data["condition"] == "TIME_UNCLEAR"
    assert data["facts"] == {"has_matching_receipt": True, "time_status": status}
    assert "time" in data["explanation"].lower()


@pytest.mark.asyncio
async def test_wrong_receiving_account_compares_accounts(client: AsyncClient):
    from review_assistance_support import create_account

    order = await _create_test_order(client)
    await submit_claim(client, order)
    second = await create_account(client, key="second-account", receiving_number="01812345678")
    await record_receipt(
        client, account_id=second["id"], key="wrong-account",
        occurred_at=datetime.datetime.fromisoformat(order["created_at"]),
    )

    data = await request_advice(client, order)
    assert data["condition"] == "WRONG_RECEIVING_ACCOUNT"
    assert data["facts"] == {
        "has_matching_receipt": True,
        "receiving_account_comparison": "different",
    }
    assert "different payment account" in data["explanation"]


@pytest.mark.asyncio
async def test_conflicting_receipts_expose_categories_without_values(client: AsyncClient):
    order = await _create_test_order(client)
    created = datetime.datetime.fromisoformat(order["created_at"])
    await record_receipt(client, order=order, key="conflict-base", occurred_at=created)
    conflicted = await record_receipt(
        client, order=order, key="conflict-second", amount_minor=150_000, occurred_at=created,
    )
    assert conflicted["has_conflict"] is True
    await submit_claim(client, order)

    data = await request_advice(client, order)
    assert data["condition"] == "CONFLICTING_RECEIPTS"
    assert data["reason_codes"] == ["CONFLICTING_RECEIPTS"]
    assert data["facts"] == {
        "has_matching_receipt": True,
        "conflict_categories": ["amount"],
    }
    assert actions(data) == ["CHECK_TRANSACTIONS"]
    assert "Conflicting receipts" in data["explanation"]
    assert "amount" in data["explanation"]
    assert "150000" not in data["explanation"]


@pytest.mark.asyncio
async def test_active_competing_claims_count_same_shop_claims(client: AsyncClient):
    order_a = await _create_test_order(client)
    order_b = await create_order(client, order_a["payment_account_id"], key="competing-b")
    await submit_claim(client, order_a)
    await submit_claim(client, order_b)
    await record_receipt(
        client, order=order_a, key="competing-receipt",
        occurred_at=datetime.datetime.fromisoformat(order_a["created_at"]),
    )

    data = await request_advice(client, order_a)
    assert data["condition"] == "COMPETING_CLAIMS"
    assert data["facts"] == {
        "has_matching_receipt": True,
        "active_claim_count": 2,
        "claim_held_by_prior_resolution": False,
    }
    assert actions(data) == ["CHECK_TRANSACTIONS"]
    assert "2 active claims" in data["explanation"]
    assert order_b["id"] not in str(data)


@pytest.mark.asyncio
async def test_prior_resolution_held_claim_is_not_active_competition(client: AsyncClient):
    order_a = await _create_test_order(client)
    order_b = await create_order(client, order_a["payment_account_id"], key="held-b")
    created = datetime.datetime.fromisoformat(order_a["created_at"])
    await record_receipt(client, order=order_a, key="held-base", occurred_at=created)
    conflicted = await record_receipt(
        client, order=order_a, key="held-conflict", amount_minor=150_000, occurred_at=created,
    )
    await submit_claim(client, order_a)
    await submit_claim(client, order_b)
    comparison = (await client.get(f"/api/seller/transactions/{conflicted['id']}")).json()
    resolved = await client.post(
        f"/api/seller/transactions/{conflicted['id']}/resolve",
        json={
            "expected_version": comparison["receipt"]["version"],
            "reason": "Select the complete base receipt",
            "selected_observation_id": comparison["receipt"]["observations"][0]["id"],
            "selected_order_id": order_a["id"],
        },
        headers={"Idempotency-Key": "held-resolve"},
    )
    assert resolved.status_code == 200, resolved.text

    data = await request_advice(client, order_b)
    assert data["condition"] == "COMPETING_CLAIMS"
    assert data["facts"] == {
        "has_matching_receipt": True,
        "active_claim_count": 0,
        "claim_held_by_prior_resolution": True,
    }
    assert actions(data) == ["CHECK_TRANSACTIONS"]
    assert "held by an earlier review decision" in data["explanation"]
    assert "not part of the active competing claims" in data["explanation"]


@pytest.mark.asyncio
async def test_payment_used_reports_used_and_allocated_without_order_identity(client: AsyncClient):
    order_a = await _create_test_order(client)
    order_b = await create_order(client, order_a["payment_account_id"], key="used-b")
    await submit_claim(client, order_b, trx_id="TXUSED")
    await record_receipt(
        client, order=order_b, trx_id="TXUSED", key="used-receipt",
        occurred_at=datetime.datetime.fromisoformat(order_b["created_at"]),
    )
    await submit_claim(client, order_a, trx_id="TXUSED")

    data = await request_advice(client, order_a)
    assert data["condition"] == "PAYMENT_USED"
    assert data["facts"] == {
        "has_matching_receipt": True,
        "payment_used": True,
        "payment_allocated": True,
    }
    assert actions(data) == ["CHECK_TRANSACTIONS"]
    assert "already used and allocated" in data["explanation"]
    assert order_b["id"] not in str(data)


@pytest.mark.asyncio
async def test_combined_hard_blockers_remain_blockers_with_existing_controls(client: AsyncClient):
    order_a = await _create_test_order(client)
    order_c = await create_order(client, order_a["payment_account_id"], key="blocker-c")
    order_b = await create_order(client, order_a["payment_account_id"], key="blocker-b")
    await submit_claim(client, order_b, trx_id="TXBLOCK")
    await record_receipt(
        client, order=order_b, trx_id="TXBLOCK", key="blocker-receipt",
        occurred_at=datetime.datetime.fromisoformat(order_b["created_at"]),
    )
    await submit_claim(client, order_a, trx_id="TXBLOCK")
    await submit_claim(client, order_c, trx_id="TXBLOCK")

    data = await request_advice(client, order_a)
    assert data["condition"] == "MULTIPLE_REVIEW_REASONS"
    assert data["reason_codes"] == ["PAYMENT_USED", "COMPETING_CLAIMS"]
    assert data["facts"]["active_claim_count"] == 2
    assert data["facts"]["payment_used"] is True
    assert data["facts"]["payment_allocated"] is True
    assert actions(data) == ["CHECK_TRANSACTIONS"]
    assert "already used" in data["explanation"]
    assert "active claims" in data["explanation"]
