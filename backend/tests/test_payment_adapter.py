import json

import httpx
import pytest

from app.core.config import settings
from app.services.payment_provider import GeminiPaymentProvider
from tests.test_payment_extraction import SUGGESTIONS


@pytest.mark.asyncio
async def test_backend_provider_sends_image_as_untrusted_content_without_tools(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-key")

    def respond(request):
        assert request.url.host == "generativelanguage.googleapis.com"
        assert "synthetic-key" not in str(request.url)
        assert request.headers["x-goog-api-key"] == "synthetic-key"
        body = json.loads(request.content)
        assert "tools" not in body
        assert body["contents"] == [
            {"role": "user", "parts": [{"inlineData": {"mimeType": "image/png", "data": "c3ludGhldGlj"}}]}
        ]
        assert "untrusted" in body["systemInstruction"]["parts"][0]["text"]
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        return httpx.Response(
            200,
            json={"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(SUGGESTIONS)}]}}]},
        )

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(respond), **kw))
    assert json.loads(await GeminiPaymentProvider().extract(b"synthetic", "image/png")) == SUGGESTIONS
