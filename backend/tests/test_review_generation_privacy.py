"""Provider payload allowlisting and conversation-language behavior with fakes only."""
import json

import pytest
from test_review_assistance_api import clean_stores, seller_identity  # noqa: F401
from test_review_generation import live, pending, reset_inflight  # noqa: F401

from app.services import review_generation


async def test_hostile_raw_input_never_reaches_provider(client, seller_identity, live, monkeypatch):  # noqa: F811
    captured = []
    async def generate(context):
        captured.append(json.loads(context.model_dump_json()))
        return '{"explanation":"Inspect the recorded transactions.","action_ids":["CHECK_TRANSACTIONS"]}'
    monkeypatch.setattr(review_generation, "generate", generate)

    product = "SECRET-PRODUCT-9"
    buyer = "Secret Buyer"
    phone = "01988887777"
    address = "Secret address, hidden lane"
    trx = "SECRETTRX9"
    shop = await client.post(
        "/api/seller/shop", json={"display_name": "Hostile Shop"},
        headers={"Idempotency-Key": "hostile-shop"},
    )
    assert shop.status_code in (200, 201)
    account = await client.post(
        "/api/seller/payment-accounts",
        json={"provider": "bkash", "receiving_number": phone, "label": "Hidden"},
        headers={"Idempotency-Key": "hostile-acc"},
    )
    order = await client.post(
        "/api/seller/orders",
        json={
            "product_name": product, "total_minor": 1200000,
            "required_advance_minor": 200000, "payment_account_id": account.json()["id"],
        },
        headers={"Idempotency-Key": "hostile-order"},
    )
    assert order.status_code == 201
    payload = order.json()
    claim = await client.post(
        f"/api/public/orders/{payload['portal_token']}/submission",
        json={
            "buyer_name": buyer,
            "contact_number": phone,
            "address": {"raw_text": address},
            "payment_claim": {
                "provider": "bkash", "trx_id": trx, "sender_number": phone, "amount_minor": 200000,
            },
        },
        headers={"Idempotency-Key": "hostile-claim"},
    )
    assert claim.status_code == 200

    response = await client.post(
        f"/api/seller/orders/{payload['id']}/review-assistance", json={"generate": True},
    )
    assert response.json()["source"] == "generated"
    assert len(captured) == 1
    wire = json.dumps(captured[0], ensure_ascii=False).lower()
    for sensitive in (product, buyer, phone, address, trx, "secret"):
        assert sensitive.lower() not in wire
    assert set(captured[0]) == {
        "condition", "reason_codes", "unknown_reason_present", "locale",
        "facts", "permitted_actions",
    }


async def test_bengali_conversation_locale_reaches_provider(client, pending, live, monkeypatch):  # noqa: F811
    captured = []
    explanation = "রেকর্ড করা লেনদেন পরীক্ষা করুন।"
    async def generate(context):
        captured.append(context)
        return json.dumps(
            {"explanation": explanation, "action_ids": ["CHECK_TRANSACTIONS"]},
            ensure_ascii=False,
        )
    monkeypatch.setattr(review_generation, "generate", generate)

    response = (await client.post(pending, json={"language": "bn", "generate": True})).json()
    assert captured[0].locale == "bn"
    assert captured[0].model_dump()["facts"] == {"has_matching_receipt": False}
    assert response["source"] == "generated"
    assert response["locale"] == "bn"
    assert response["explanation"] == explanation
    assert response["suggested_actions"][0]["label"] == "লেনদেন পরীক্ষা করুন"


@pytest.mark.parametrize("language", ["en", "bn"])
async def test_local_fallback_matches_requested_language(client, pending, live, monkeypatch, language):  # noqa: F811
    async def generate(context):
        raise review_generation.RejectedGeneration()
    monkeypatch.setattr(review_generation, "generate", generate)
    response = (await client.post(pending, json={"language": language, "generate": True})).json()
    assert response["source"] == "local"
    assert response["fallback_status"] == "rejected"
    assert response["locale"] == language
    assert response["explanation"]
