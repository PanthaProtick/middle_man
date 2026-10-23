from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services.gemini import GeminiService


async def test_empty_chat_text_enters_existing_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GeminiService()
    generate = Mock(return_value=SimpleNamespace(text=None))
    fallback = Mock(return_value=SimpleNamespace(output_text="Recovered reply"))
    monkeypatch.setattr(service, "client", SimpleNamespace(
        models=SimpleNamespace(generate_content=generate),
        interactions=SimpleNamespace(create=fallback),
    ))
    result = await service.generate_chat("Hello")
    assert result["reply"] == "Recovered reply"
    assert result["is_mock"] is False
    fallback.assert_called_once()


async def test_provider_failures_return_existing_error_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GeminiService()
    monkeypatch.setattr(service, "client", SimpleNamespace(
        models=SimpleNamespace(generate_content=Mock(side_effect=RuntimeError("provider unavailable"))),
        interactions=SimpleNamespace(create=Mock(side_effect=RuntimeError("fallback unavailable"))),
    ))
    result = await service.generate_chat("Hello")
    assert result["reply"] == "Gemini API Error: provider unavailable"
    assert result["is_mock"] is False
