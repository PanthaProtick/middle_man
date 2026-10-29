"""Self-test policy is independent of credentials, caches and provider health."""
from unittest.mock import Mock

import pytest

from app.core.config import settings
from app.services.gemini import gemini_service


@pytest.mark.asyncio
async def test_disabled_policy_blocks_all_provider_boundaries(monkeypatch):
    monkeypatch.setattr(settings, "SELF_TEST_MODE", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-key")
    client = Mock()
    monkeypatch.setattr(gemini_service, "client", client)
    assert not gemini_service.is_configured()
    assert (await gemini_service.generate_chat("synthetic"))["is_mock"]
    await gemini_service.generate_structured_idea("synthetic")
    client.models.generate_content.assert_not_called()
    client.interactions.create.assert_not_called()


def test_address_assistance_configuration_is_retired(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-key")
    monkeypatch.setattr(settings, "SELF_TEST_MODE", False)
    assert not hasattr(settings, "ai_assistance_available")
    assert settings.ai_enabled is True
    monkeypatch.setattr(settings, "SELF_TEST_MODE", True)
    assert settings.ai_enabled is False
