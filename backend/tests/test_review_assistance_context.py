import datetime
import json
from copy import deepcopy

import pytest
from httpx import AsyncClient
from review_assistance_support import (
    CLAIM_SENDER,
    OTHER_SENDER,
    create_order,
    record_receipt,
    submit_claim,
)
from test_public_order_routes import _create_test_order
from test_review_assistance_api import clean_stores, seller_identity  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.services.buyer_service import _memory_buyer_revisions
from app.services.order_service import _memory_orders
from app.services.reconciliation_store import (
    _memory_allocations,
    _memory_audit_events,
    _memory_order_review_reasons,
)
from app.services.transaction_store import _memory_transactions

pytestmark = pytest.mark.usefixtures("seller_identity")


async def request_advice(client: AsyncClient, order: dict, **payload) -> dict:
    response = await client.post(f"/api/seller/orders/{order['id']}/review-assistance", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


async def combined_mismatch(client: AsyncClient) -> dict:
    order = await _create_test_order(client)
    await submit_claim(client, order)
    await record_receipt(
        client, order=order, sender=OTHER_SENDER, amount_minor=150_000, key="combined",
    )
    return order


@pytest.mark.asyncio
async def test_combined_reasons_explain_each_reason_and_dedupe_actions(client: AsyncClient):
    order = await combined_mismatch(client)
    data = await request_advice(client, order)
    assert data["condition"] == "MULTIPLE_REVIEW_REASONS"
    assert data["reason_codes"] == ["AMOUNT_MISMATCH", "SENDER_MISMATCH", "TIME_UNCLEAR"]
    assert data["facts"] == {
        "has_matching_receipt": True,
        "required_advance_minor": 200_000,
        "claimed_amount_minor": 200_000,
        "received_amount_minor": 150_000,
        "currency": "BDT",
        "sender_status": "different",
        "time_status": "missing",
    }
    assert [item["action_id"] for item in data["suggested_actions"]] == [
        "CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS",
    ]
    assert data["explanation"].startswith("This submission has several review reasons.")
    assert "BDT 1,500.00" in data["explanation"]
    assert "different from the sender number" in data["explanation"]
    assert "has no time" in data["explanation"]

    bengali = await request_advice(client, order, language="bn")
    assert bengali["context_token"] == data["context_token"]
    assert bengali["explanation"].startswith("এই জমাদানে একাধিক পর্যালোচনা কারণ রয়েছে।")
    assert "BDT 1,500.00" in bengali["explanation"]


@pytest.mark.asyncio
async def test_unknown_stored_code_with_known_reason_appends_only_generic_note(client: AsyncClient):
    order = await _create_test_order(client)
    await submit_claim(client, order)
    await record_receipt(
        client, order=order, sender=OTHER_SENDER, key="unknown-known",
        occurred_at=datetime.datetime.fromisoformat(order["created_at"]),
    )
    _memory_order_review_reasons[order["id"]] = ["FUTURE_REASON"]

    data = await request_advice(client, order)
    assert data["condition"] == "SENDER_MISMATCH"
    assert data["reason_codes"] == ["SENDER_MISMATCH"]
    assert data["unknown_reason_present"] is True
    assert "different from the sender number" in data["explanation"]
    assert "not recognized by this version" in data["explanation"]
    assert [item["action_id"] for item in data["suggested_actions"]] == [
        "CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS",
    ]
    assert "approve" not in data["explanation"].lower()


@pytest.mark.asyncio
async def test_same_shop_aggregation_excludes_foreign_claims(client: AsyncClient, request):
    order_a = await _create_test_order(client)
    order_b = await create_order(client, order_a["payment_account_id"], key="aggregate-b")
    await submit_claim(client, order_a, trx_id="TXSHARED")
    await submit_claim(client, order_b, trx_id="TXSHARED")

    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity(owner_id="foreign-reason-owner")
    foreign = await _create_test_order(client)
    await submit_claim(client, foreign, trx_id="TXSHARED")
    original_seller = request.getfixturevalue("seller_identity")
    app.dependency_overrides[get_seller_identity] = lambda: original_seller

    await record_receipt(
        client, order=order_a, trx_id="TXSHARED", sender=OTHER_SENDER, key="aggregate-receipt",
        occurred_at=datetime.datetime.fromisoformat(order_a["created_at"]),
    )
    data = await request_advice(client, order_a)
    assert data["condition"] == "MULTIPLE_REVIEW_REASONS"
    assert data["reason_codes"] == ["COMPETING_CLAIMS", "SENDER_MISMATCH"]
    assert data["facts"]["active_claim_count"] == 2
    assert foreign["id"] not in str(data)


@pytest.mark.asyncio
async def test_context_projection_is_exact_and_excludes_private_values(client: AsyncClient):
    order = await combined_mismatch(client)
    receipt = next(item for item in _memory_transactions.values()
                   if item["shop_id"] == order["shop_id"] and item["trx_id"] == "TX12345")
    _memory_orders[order["id"]]["product_name"] = "SECRET-PRODUCT"
    _memory_buyer_revisions[order["id"]][-1].update(
        buyer_name="SECRET-BUYER", contact_number_raw="SECRET-PHONE", address_raw="SECRET-ADDRESS",
    )
    _memory_transactions[receipt["id"]]["sender_number_raw"] = "SECRET-SENDER-RAW"
    _memory_audit_events.append({
        "id": "secret-audit", "shop_id": order["shop_id"], "aggregate_type": "order",
        "aggregate_id": order["id"], "actor": "seller", "action": "note",
        "details": "SECRET-AUDIT-DETAIL", "created_at": datetime.datetime.now(datetime.timezone.utc),
    })

    data = await request_advice(client, order)
    assert data["context"] == {
        "condition": "MULTIPLE_REVIEW_REASONS",
        "reason_codes": ["AMOUNT_MISMATCH", "SENDER_MISMATCH", "TIME_UNCLEAR"],
        "unknown_reason_present": False,
        "locale": "en",
        "facts": {
            "has_matching_receipt": True,
            "required_advance_minor": 200_000,
            "claimed_amount_minor": 200_000,
            "received_amount_minor": 150_000,
            "currency": "BDT",
            "sender_status": "different",
            "time_status": "missing",
        },
        "permitted_actions": ["CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS"],
    }
    serialized = json.dumps(data["context"])
    for private in ("SECRET", order["id"], receipt["id"], CLAIM_SENDER, "Rahim", "Dhanmondi"):
        assert private not in serialized
        assert private not in data["explanation"]


@pytest.mark.asyncio
async def test_assistance_leaves_business_records_unchanged(client: AsyncClient):
    order = await combined_mismatch(client)
    before = deepcopy((
        _memory_orders, _memory_buyer_revisions, _memory_transactions,
        _memory_order_review_reasons, _memory_allocations, _memory_audit_events,
    ))
    await request_advice(client, order, language="en")
    await request_advice(client, order, language="bn")
    after = (
        _memory_orders, _memory_buyer_revisions, _memory_transactions,
        _memory_order_review_reasons, _memory_allocations, _memory_audit_events,
    )
    assert before == after


@pytest.mark.asyncio
async def test_related_claim_change_changes_context_token(client: AsyncClient):
    order_a = await _create_test_order(client)
    order_b = await create_order(client, order_a["payment_account_id"], key="token-b")
    await submit_claim(client, order_a, trx_id="TXTOKEN")
    await submit_claim(client, order_b, trx_id="TXTOKEN")
    await record_receipt(
        client, order=order_a, trx_id="TXTOKEN", sender=OTHER_SENDER, key="token-receipt",
        occurred_at=datetime.datetime.fromisoformat(order_a["created_at"]),
    )
    first = await request_advice(client, order_a)
    assert first["facts"]["active_claim_count"] == 2

    order_c = await create_order(client, order_a["payment_account_id"], key="token-c")
    await submit_claim(client, order_c, trx_id="TXTOKEN")
    second = await request_advice(client, order_a)
    assert second["facts"]["active_claim_count"] == 3
    assert second["context_token"] != first["context_token"]


@pytest.mark.asyncio
async def test_resolution_history_change_changes_context_token(client: AsyncClient):
    order_a = await _create_test_order(client)
    order_b = await create_order(client, order_a["payment_account_id"], key="history-b")
    created = datetime.datetime.fromisoformat(order_a["created_at"])
    await record_receipt(client, order=order_a, key="history-base", occurred_at=created)
    conflicted = await record_receipt(
        client, order=order_a, key="history-conflict", amount_minor=150_000, occurred_at=created,
    )
    await submit_claim(client, order_a)
    await submit_claim(client, order_b)
    before = await request_advice(client, order_b)
    assert before["facts"]["claim_held_by_prior_resolution"] is False
    assert before["facts"]["active_claim_count"] == 2

    comparison = (await client.get(f"/api/seller/transactions/{conflicted['id']}")).json()
    resolved = await client.post(
        f"/api/seller/transactions/{conflicted['id']}/resolve",
        json={
            "expected_version": comparison["receipt"]["version"],
            "reason": "Select the complete base receipt",
            "selected_observation_id": comparison["receipt"]["observations"][0]["id"],
            "selected_order_id": order_a["id"],
        },
        headers={"Idempotency-Key": "history-resolve"},
    )
    assert resolved.status_code == 200, resolved.text
    after = await request_advice(client, order_b)
    assert after["facts"]["claim_held_by_prior_resolution"] is True
    assert after["facts"]["active_claim_count"] == 0
    assert after["context_token"] != before["context_token"]
