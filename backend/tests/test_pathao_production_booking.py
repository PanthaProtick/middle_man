"""Production opt-in and transport checks; all provider traffic is mocked."""
import httpx
import pytest
from pathao_sandbox_support import (
    CONSIGNMENT,
    booking_snapshot,
    create_calls,
    provider_router,
    sandbox_credentials,
    sandbox_settings,  # noqa: F401
)

from app.core.auth import AuthenticationError, get_seller_identity
from app.core.config import Settings, settings
from app.core.database import DurableStorageUnavailableError, ensure_durable_storage
from app.services import pathao_connections, pathao_provider


def test_production_opt_in_requires_durable_storage_and_reports_capability(monkeypatch):
    assert not Settings(_env_file=None).PATHAO_PRODUCTION_BOOKING_ENABLED
    monkeypatch.setattr(settings, 'PATHAO_PRODUCTION_BOOKING_ENABLED', True)
    assert settings.is_durable_mode
    with pytest.raises(DurableStorageUnavailableError):
        ensure_durable_storage(None, 'production booking')
    assert pathao_connections.view('production', pathao_connections.Revision(0)).production_booking_enabled


async def test_production_opt_in_rejects_development_seller_token(monkeypatch):
    from starlette.requests import Request

    monkeypatch.setattr(settings, 'PATHAO_PRODUCTION_BOOKING_ENABLED', True)
    with pytest.raises(AuthenticationError):
        await get_seller_identity(Request({'type': 'http'}), 'Bearer mock-seller-token')


async def test_disabled_production_transport_never_sends_create(monkeypatch):
    calls = provider_router(monkeypatch)
    monkeypatch.setattr(settings, 'PATHAO_PRODUCTION_BOOKING_ENABLED', False)
    with pytest.raises(pathao_provider.CourierDefinitiveFailure):
        await pathao_provider.submit_booking('shop', 'production', booking_snapshot(), sandbox_credentials())
    assert calls == []


async def test_enabled_production_uses_production_host_and_can_reconcile_after_disable(monkeypatch):
    snapshot = booking_snapshot()
    calls = provider_router(monkeypatch, lookup=lambda: httpx.Response(200, json={
        'data': {'consignment_id': CONSIGNMENT, 'merchant_order_id': snapshot.order_id, 'store_id': 321},
    }))
    monkeypatch.setattr(settings, 'PATHAO_PRODUCTION_BOOKING_ENABLED', True)
    result = await pathao_provider.submit_booking('shop', 'production', snapshot, sandbox_credentials())
    assert result.consignment_id == CONSIGNMENT
    assert not result.is_simulated
    assert len(create_calls(calls)) == 1
    # Turning off new bookings must not strand an already-created consignment.
    monkeypatch.setattr(settings, 'PATHAO_PRODUCTION_BOOKING_ENABLED', False)
    evidence = await pathao_provider.lookup_booking(
        'shop', 'production', CONSIGNMENT, snapshot.order_id, 321, sandbox_credentials(),
    )
    assert evidence.environment == 'production'
    assert evidence.merchant_order_id == snapshot.order_id
    assert not evidence.is_simulated
    assert all(call.url.host == 'api-hermes.pathao.com' for call in calls)


async def test_production_timeout_does_not_retry_create(monkeypatch):
    def timeout():
        raise httpx.ReadTimeout('response lost')

    calls = provider_router(monkeypatch, create=timeout)
    monkeypatch.setattr(settings, 'PATHAO_PRODUCTION_BOOKING_ENABLED', True)
    with pytest.raises(httpx.ReadTimeout):
        await pathao_provider.submit_booking('shop', 'production', booking_snapshot(), sandbox_credentials())
    assert len(create_calls(calls)) == 1
