from unittest.mock import Mock

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.services.gemini import GeminiService, gemini_service


async def test_public_chat_is_permanently_local_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GeminiService()
    mock_client = Mock()
    monkeypatch.setattr(service, "client", mock_client)

    result = await service.generate_chat("How do I hack?")
    assert result["is_mock"] is True
    assert result["model"] == "mock-gemini-preview"
    assert "Public demonstrations run locally in mock mode" in result["reply"]
    assert "reserved for seller review" in result["reply"]
    mock_client.models.generate_content.assert_not_called()
    mock_client.interactions.create.assert_not_called()


async def test_public_idea_generator_is_permanently_local_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GeminiService()
    mock_client = Mock()
    monkeypatch.setattr(service, "client", mock_client)

    idea = await service.generate_structured_idea("Fintech", target_audience="Students")
    assert idea.title == "Smart Fintech Hub"
    assert "Students" in idea.tagline
    assert len(idea.core_features) > 0
    assert len(idea.suggested_tech_stack) > 0
    mock_client.models.generate_content.assert_not_called()
    mock_client.interactions.create.assert_not_called()


async def test_http_chat_endpoint_remains_mock_with_credentials(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-gemini-key")
    monkeypatch.setattr(settings, "SELF_TEST_MODE", False)
    mock_client = Mock()
    monkeypatch.setattr(gemini_service, "client", mock_client)

    response = await client.post(
        "/api/chat", json={"message": "Tell me a joke", "conversation_id": "conv-42"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["conversation_id"] == "conv-42"
    assert data["is_mock"] is True
    assert data["model"] == "mock-gemini-preview"
    assert "Public demonstrations run locally in mock mode" in data["reply"]
    mock_client.models.generate_content.assert_not_called()
    mock_client.interactions.create.assert_not_called()


async def test_http_generate_idea_endpoint_remains_mock_with_credentials(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-gemini-key")
    monkeypatch.setattr(settings, "SELF_TEST_MODE", False)
    mock_client = Mock()
    monkeypatch.setattr(gemini_service, "client", mock_client)

    response = await client.post(
        "/api/generate-idea", json={"topic": "Health", "target_audience": "Nurses"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Smart Health Hub"
    assert "Nurses" in data["tagline"]
    assert len(data["core_features"]) > 0
    assert len(data["suggested_tech_stack"]) > 0
    mock_client.models.generate_content.assert_not_called()
    mock_client.interactions.create.assert_not_called()


def test_gemini_configuration_status(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    assert not settings.is_gemini_configured

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "your-gemini-api-key")
    assert not settings.is_gemini_configured

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "valid-key-xyz")
    monkeypatch.setattr(settings, "SELF_TEST_MODE", False)
    assert settings.is_gemini_configured
    assert gemini_service.is_configured()

    monkeypatch.setattr(settings, "SELF_TEST_MODE", True)
    assert not settings.is_gemini_configured
    assert not gemini_service.is_configured()
