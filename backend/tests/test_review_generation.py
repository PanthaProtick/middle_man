"""Live assistant behavior through authenticated HTTP and a captured provider."""
import json

import pytest
from httpx import AsyncClient
from test_public_order_routes import _create_test_order
from test_review_assistance_api import _submit_buyer_claim, clean_stores, seller_identity  # noqa: F401

from app.core.config import settings
from app.services import review_generation, review_generation_limits


@pytest.fixture(autouse=True)
def reset_limits(monkeypatch):
    monkeypatch.setattr(review_generation, "limits", review_generation_limits.AttemptLimits())


@pytest.fixture
async def pending(client, seller_identity):  # noqa: F811
    order = await _create_test_order(client)
    await _submit_buyer_claim(client, order["portal_token"])
    return f"/api/seller/orders/{order['id']}/review-assistance"


@pytest.mark.asyncio
async def test_explicit_generation_discloses_only_context(client: AsyncClient, seller_identity, monkeypatch):  # noqa: F811
    from app.services import review_generation

    captured = []

    async def generate(context):
        captured.append(json.loads(context.model_dump_json()))
        return '{"explanation":"Inspect the recorded transactions.","action_ids":["CHECK_TRANSACTIONS"]}'

    monkeypatch.setattr(settings, "REVIEW_GEMINI_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-key")
    monkeypatch.setattr(review_generation, "generate", generate)
    order = await _create_test_order(client)
    await _submit_buyer_claim(client, order["portal_token"])
    response = await client.post(
        f"/api/seller/orders/{order['id']}/review-assistance", json={"generate": True},
    )
    assert response.status_code == 200
    assert response.json()["source"] == "generated"
    assert response.json()["explanation"] == "Inspect the recorded transactions."
    assert captured == [{
        "condition": "NO_RECORDED_RECEIPT", "reason_codes": [],
        "unknown_reason_present": False, "locale": "en",
        "facts": {"has_matching_receipt": False},
        "permitted_actions": ["CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS"],
    }]


@pytest.mark.parametrize("enabled,key,self_test,status", [
    (False, "synthetic-key", False, "disabled"),
    (True, "", False, "unconfigured"),
    (True, "synthetic-key", True, "disabled"),
])
async def test_policy_without_provider(client, pending, monkeypatch, enabled, key, self_test, status):
    monkeypatch.setattr(settings, "REVIEW_GEMINI_ENABLED", enabled)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", key)
    monkeypatch.setattr(settings, "SELF_TEST_MODE", self_test)
    # Exercise the AI self-test override with synthetic HTTP storage.
    monkeypatch.setattr(type(settings), "is_durable_mode", property(lambda self: False))
    response = await client.post(pending, json={"generate": True})
    assert response.json()["fallback_status"] == status
    assert response.json()["source"] == "local"
    assert review_generation.limits.total == 0


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setattr(settings, "REVIEW_GEMINI_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-key")


@pytest.mark.parametrize("output", [
    'not json', '{"explanation":"ok","action_ids":["APPROVE"]}',
    '{"explanation":"https://evil.example","action_ids":[]}',
    '{"explanation":"Open //evil.xyz/approve","action_ids":[]}',
    '{"explanation":"Visit evil.xyz","action_ids":[]}',
    '{"explanation":"custom:approve","action_ids":[]}',
    '{"explanation":"Open 192.168.1.1","action_ids":[]}',
    '{"explanation":"ok","action_ids":[],"url":"evil"}',
    '{"explanation":"","action_ids":[]}', 'x' * 9000,
])
async def test_malformed_output_keeps_controls(client, pending, live, monkeypatch, output):
    async def generate(context):
        return output
    monkeypatch.setattr(review_generation, "generate", generate)
    response = (await client.post(pending, json={"generate": True})).json()
    assert response["source"] == "local"
    assert response["fallback_status"] == "malformed"
    assert len(response["suggested_actions"]) == 2
    assert review_generation.limits.total == 1


@pytest.mark.parametrize("failure,status", [
    (TimeoutError("private"), "timeout"),
    (review_generation.RejectedGeneration("secret"), "rejected"),
    (RuntimeError("credential and private payload"), "unavailable"),
])
async def test_failed_attempt_counts_without_retry(client, pending, live, monkeypatch, failure, status):
    calls = []
    async def generate(context):
        calls.append(context)
        raise failure
    monkeypatch.setattr(review_generation, "generate", generate)
    response = await client.post(pending, json={"generate": True})
    assert response.json()["fallback_status"] == status
    assert "private" not in response.text and "secret" not in response.text
    assert len(calls) == 1
    assert (await client.post(pending, json={"generate": True})).json()["fallback_status"] == "limited"
    assert len(calls) == 1


async def test_inflight_duplicate_and_stale_output(client, pending, live, monkeypatch):
    import asyncio

    from app.services.order_service import _memory_orders

    started, finish = asyncio.Event(), asyncio.Event()
    async def generate(context):
        started.set()
        await finish.wait()
        return '{"explanation":"Obsolete advice","action_ids":[]}'
    monkeypatch.setattr(review_generation, "generate", generate)
    task = asyncio.create_task(client.post(pending, json={"generate": True}))
    await started.wait()
    duplicate = await client.post(pending, json={"generate": True})
    assert duplicate.json()["fallback_status"] == "busy"
    local = await client.post(pending, json={})
    assert local.json()["source"] == "local"
    _memory_orders[local.json()["order_id"]]["version"] += 1
    finish.set()
    response = await task
    assert response.status_code == 409
    assert "Obsolete advice" not in response.text
    assert review_generation.limits.total == 1


async def test_daily_and_context_caps_and_dhaka_rollover(client, pending, live, monkeypatch):
    from datetime import datetime, timedelta, timezone

    clock = [datetime(2026, 10, 30, 17, 54, tzinfo=timezone.utc)]
    monkeypatch.setattr(review_generation_limits, "now", lambda: clock[0])
    async def generate(context):
        return '{"explanation":"Review the evidence.","action_ids":[]}'
    monkeypatch.setattr(review_generation, "generate", generate)
    for _ in range(5):
        assert (await client.post(pending, json={"generate": True})).json()["source"] == "generated"
        clock[0] += timedelta(minutes=1)
    assert (await client.post(pending, json={"generate": True})).json()["fallback_status"] == "limited"
    clock[0] += timedelta(minutes=1)  # Dhaka midnight resets daily, but not unchanged-context cap.
    assert (await client.post(pending, json={"generate": True})).json()["fallback_status"] == "limited"
    from review_assistance_support import create_order
    original = (await client.post(pending, json={})).json()
    from app.services.order_service import _memory_orders
    account = _memory_orders[original["order_id"]]["payment_account_id"]
    order = await create_order(client, account, key="second-order")
    await _submit_buyer_claim(client, order["portal_token"], trx_id="SECOND")
    other = f"/api/seller/orders/{order['id']}/review-assistance"
    assert (await client.post(other, json={"generate": True})).json()["source"] == "generated"
