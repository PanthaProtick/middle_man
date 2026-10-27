"""Self-test policy is independent of credentials, caches and provider health."""
from unittest.mock import Mock

import pytest

from app.core.config import settings
from app.models.buyer import PublicOrder
from app.services.address_provider import GeminiAddressProvider
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
    with pytest.raises(ValueError, match="Provider unavailable"):
        await GeminiAddressProvider().extract("Dhaka")


def test_public_availability_uses_current_policy_even_for_cached_responses(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-key")
    monkeypatch.setattr(settings, "SELF_TEST_MODE", False)
    order = PublicOrder(
        id="order", shop_display_name="Shop", product_name="Item", total_minor=100,
        required_advance_minor=50, expected_cod_minor=50, account_provider="bkash",
        account_receiving_number="01712345678", account_label="Shop",
        lifecycle="awaiting_buyer", status_message="Enter details",
        created_at="2026-10-24T00:00:00Z", expires_at="2026-10-26T00:00:00Z",
    )
    cached = order.model_dump()
    assert cached["ai_assistance_available"] is True
    monkeypatch.setattr(settings, "SELF_TEST_MODE", True)
    assert PublicOrder(**cached).model_dump()["ai_assistance_available"] is False
    monkeypatch.setattr(settings, "SELF_TEST_MODE", False)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    assert order.model_dump()["ai_assistance_available"] is False
