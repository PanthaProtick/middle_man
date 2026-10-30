"""Application/shop caps via authenticated requests and deterministic time."""
from datetime import datetime, timedelta, timezone

import pytest
from test_public_order_routes import _create_test_order
from test_review_assistance_api import _submit_buyer_claim, clean_stores, seller_identity  # noqa: F401
from test_review_generation import live, pending, reset_limits  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.core.config import settings
from app.main import app
from app.services import review_generation, review_generation_limits


@pytest.fixture
def clock(monkeypatch):
    value = [datetime(2026, 10, 30, 0, tzinfo=timezone.utc)]
    monkeypatch.setattr(review_generation_limits, "now", lambda: value[0])
    async def generate(context):
        return '{"explanation":"Review evidence.","action_ids":[]}'
    monkeypatch.setattr(review_generation, "generate", generate)
    return value


async def test_shared_ceiling_across_shops(client, pending, live, clock):  # noqa: F811
    for number in range(5):
        app.dependency_overrides[get_seller_identity] = lambda n=number: SellerIdentity(f"shop-{n}")
        order = await _create_test_order(client)
        await _submit_buyer_claim(client, order["portal_token"])
        path = f"/api/seller/orders/{order['id']}/review-assistance"
        assert (await client.post(path, json={"generate": True})).json()["source"] == "generated"
        clock[0] += timedelta(minutes=1)
    app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity("sixth-shop")
    order = await _create_test_order(client)
    await _submit_buyer_claim(client, order["portal_token"])
    path = f"/api/seller/orders/{order['id']}/review-assistance"
    assert (await client.post(path, json={"generate": True})).json()["fallback_status"] == "limited"
    assert review_generation.limits.total == 5


async def test_minute_boundary_and_shop_limit(client, pending, live, clock, monkeypatch):  # noqa: F811
    monkeypatch.setattr(settings, "REVIEW_GEMINI_SHOP_DAILY_LIMIT", 2)
    assert (await client.post(pending, json={"generate": True})).json()["source"] == "generated"
    clock[0] += timedelta(seconds=59)
    assert (await client.post(pending, json={"generate": True})).json()["fallback_status"] == "limited"
    clock[0] += timedelta(seconds=1)
    assert (await client.post(pending, json={"generate": True})).json()["source"] == "generated"
    clock[0] += timedelta(minutes=1)
    assert (await client.post(pending, json={"generate": True})).json()["fallback_status"] == "limited"
    assert review_generation.limits.total == 2


async def test_five_context_attempts_across_days(client, pending, live, clock):  # noqa: F811
    for _ in range(5):
        assert (await client.post(pending, json={"generate": True})).json()["source"] == "generated"
        clock[0] += timedelta(days=1)
    assert (await client.post(pending, json={"generate": True})).json()["fallback_status"] == "limited"


async def test_new_context_capacity_fails_closed(client, pending, live, clock):  # noqa: F811
    # Accepted bounded metadata policy: preserve old context counts; reject new
    # contexts when full instead of eviction that would reopen an exhausted cap.
    review_generation.limits.contexts = {str(i): 1 for i in range(1024)}
    assert (await client.post(pending, json={"generate": True})).json()["fallback_status"] == "limited"
    assert review_generation.limits.total == 0
