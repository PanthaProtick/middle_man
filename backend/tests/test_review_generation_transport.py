"""Provider wire contract and authorization failures, without external networking."""
import json

import httpx
import pytest
from test_review_assistance_api import clean_stores, seller_identity  # noqa: F401
from test_review_generation import live, pending, reset_limits  # noqa: F401

from app.core.auth import SellerIdentity, get_seller_identity
from app.main import app
from app.services import review_generation


@pytest.mark.parametrize("metadata", [
    {}, {"thoughtSignature": "synthetic-opaque-signature"},
    {"thought": False, "thoughtSignature": "synthetic-opaque-signature"},
])
@pytest.mark.parametrize("status", [200, 429, 503])
async def test_wire_request_and_no_provider_retries(client, pending, live, monkeypatch, status, metadata):  # noqa: F811
    captured = []
    original_client = httpx.AsyncClient

    async def provider(request):
        captured.append(request)
        return httpx.Response(status, json={"candidates": [{
            "finishReason": "STOP", "content": {"parts": [{"text": json.dumps({
                "explanation": "Inspect the seller records.", "action_ids": ["CHECK_TRANSACTIONS"],
            }), **metadata}]},
        }]})

    def provider_client(**kwargs):
        return original_client(transport=httpx.MockTransport(provider), **kwargs)
    monkeypatch.setattr(review_generation.httpx, "AsyncClient", provider_client)
    result = (await client.post(pending, json={"generate": True})).json()
    assert len(captured) == 1
    request = captured[0]
    assert request.url.host == "generativelanguage.googleapis.com"
    assert request.url.query == b""
    assert request.headers["x-goog-api-key"] == "synthetic-key"
    body = json.loads(request.content)
    assert set(body) == {"systemInstruction", "contents", "generationConfig"}
    assert body["contents"] == [{"role": "user", "parts": [{"text": json.dumps({
        "condition": "NO_RECORDED_RECEIPT", "reason_codes": [], "unknown_reason_present": False,
        "locale": "en", "facts": {"has_matching_receipt": False},
        "permitted_actions": ["CHECK_TRANSACTIONS", "CORRECT_BUYER_DETAILS"],
    }, separators=(',', ':'))}]}]
    assert result["source"] == ("generated" if status == 200 else "local")
    assert result["fallback_status"] == (None if status == 200 else "rejected")
    await client.post(pending, json={})
    assert len(captured) == 1


@pytest.mark.parametrize("case,expected", [
    ("foreign", 404), ("unauthenticated", 401), ("receipt", 404),
    ("retained", 410), ("nonpending", 409),
])
async def test_ineligible_requests_never_dispatch(client, pending, live, monkeypatch, case, expected):  # noqa: F811
    from datetime import datetime, timezone

    from app.services.order_service import _memory_orders

    async def forbidden(context):
        pytest.fail("Unauthorized generation")
    monkeypatch.setattr(review_generation, "generate", forbidden)
    payload = {"generate": True}
    if case == "foreign":
        app.dependency_overrides[get_seller_identity] = lambda: SellerIdentity("foreign")
    elif case == "unauthenticated":
        app.dependency_overrides.pop(get_seller_identity)
    elif case == "receipt":
        payload["receipt_id"] = "missing"
    else:
        order_id = pending.split("/")[-2]
        _memory_orders[order_id].update(
            {"retained_at": datetime.now(timezone.utc)} if case == "retained" else {"lifecycle": "confirmed"},
        )
    assert (await client.post(pending, json=payload)).status_code == expected
    assert review_generation.limits.total == 0


@pytest.mark.parametrize("body", [
    b"x" * 17000, b"not JSON", b'{"candidates":[]}',
    b'{"candidates":[{"finishReason":"MAX_TOKENS"}]}',
])
async def test_unusable_wire_response_is_local(client, pending, live, monkeypatch, body):  # noqa: F811
    original_client = httpx.AsyncClient
    monkeypatch.setattr(review_generation.httpx, "AsyncClient", lambda **kwargs: original_client(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, content=body)), **kwargs,
    ))
    result = (await client.post(pending, json={"generate": True})).json()
    assert result["source"] == "local"
    assert result["fallback_status"] in ("malformed", "rejected")
    assert review_generation.limits.total == 1


@pytest.mark.parametrize("part", [
    {"thought": True},
    {"thought": "false"},
    {"thoughtSignature": {"text": "untrusted"}},
    {"functionCall": {"name": "approve"}},
    {"text": {"explanation": "Do not coerce non-text output", "action_ids": []}},
])
async def test_invalid_part_metadata_keeps_local_guidance(client, pending, live, monkeypatch, part):  # noqa: F811
    original_client = httpx.AsyncClient
    part = {"text": json.dumps({"explanation": "Inspect the seller records.", "action_ids": []}), **part}
    body = {"candidates": [{"finishReason": "STOP", "content": {"parts": [part]}}]}
    monkeypatch.setattr(review_generation.httpx, "AsyncClient", lambda **kwargs: original_client(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=body)), **kwargs,
    ))
    result = (await client.post(pending, json={"generate": True})).json()
    assert result["source"] == "local"
    assert result["fallback_status"] == "malformed"
    assert len(result["suggested_actions"]) == 2
    assert review_generation.limits.total == 1
