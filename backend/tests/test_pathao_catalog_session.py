"""Retired sync entry points must generate zero provider requests or authentication calls."""
import httpx

from app.services import pathao_catalog as catalog
from app.services import pathao_snapshot_sync as sync


async def test_retired_sync_entry_points_generate_zero_provider_traffic(monkeypatch):
    catalog.clear_cache()
    provider_calls = 0

    async def respond(request):
        nonlocal provider_calls
        provider_calls += 1
        return httpx.Response(200, json={})

    monkeypatch.setattr(catalog.provider, 'transport', lambda: httpx.MockTransport(respond))

    # Calling run_one or run_due must be safe no-ops and make zero provider requests
    await sync.run_one('shop-a', 'sandbox')
    await sync.run_one('shop-a', 'production', manual=True)
    await sync.run_due()

    assert provider_calls == 0
