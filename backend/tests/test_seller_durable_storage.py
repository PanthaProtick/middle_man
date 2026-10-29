import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import OperationalError

from app.core.database import DurableStorageUnavailableError
from app.models.seller import ShopInput
from app.services.seller_service import (
    SellerService,
    _memory_shops,
    compute_payload_hash,
    reset_memory_store,
)


@pytest.mark.asyncio
async def test_seller_shop_mutation_blocks_in_durable_mode_when_db_unconfigured(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, verified_seller_identity: None
) -> None:
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", True)
    monkeypatch.setattr("app.core.database.AsyncSessionLocal", None)

    resp = await client.post(
        "/api/seller/shop",
        json={"display_name": "Test Durable Shop"},
        headers={"Authorization": "Bearer dev-pilot_seller", "Idempotency-Key": "key-durable-1"},
    )
    assert resp.status_code == 503
    data = resp.json()
    assert data["error"]["code"] == "DURABLE_STORAGE_UNAVAILABLE"
    assert "durable storage is required" in data["error"]["message"].lower()
    assert len(_memory_shops) == 0


@pytest.mark.asyncio
async def test_seller_shop_mutation_in_offline_mode_succeeds_in_memory(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", False)
    monkeypatch.setattr("app.core.config.settings.ENV", "test")
    monkeypatch.setattr("app.core.database.AsyncSessionLocal", None)

    reset_memory_store()

    resp = await client.post(
        "/api/seller/shop",
        json={"display_name": "Test Offline Shop"},
        headers={"Authorization": "Bearer dev-offline_seller", "Idempotency-Key": "key-offline-1"},
    )
    assert resp.status_code == 201
    assert resp.json()["shop"]["display_name"] == "Test Offline Shop"


@pytest.mark.asyncio
async def test_seller_shop_mutation_database_runtime_outage_returns_503(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, verified_seller_identity: None
) -> None:
    """Verifies that get_db catches real session errors, rolls back, and raises typed 503."""
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", True)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock(side_effect=OperationalError("connection closed unexpectedly", params=None, orig=Exception("DB down")))
    mock_session.rollback = AsyncMock(return_value=None)
    mock_session.close = AsyncMock(return_value=None)

    class MockSessionFactory:
        def __call__(self) -> MagicMock:
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=mock_session)
            ctx.__aexit__ = AsyncMock(return_value=None)
            return ctx

    monkeypatch.setattr("app.core.database.AsyncSessionLocal", MockSessionFactory())
    reset_memory_store()

    resp = await client.post(
        "/api/seller/shop",
        json={"display_name": "Outage Test Shop"},
        headers={"Authorization": "Bearer dev-pilot_seller", "Idempotency-Key": "outage-key-1"},
    )
    assert resp.status_code == 503
    data = resp.json()
    assert data["error"]["code"] == "DURABLE_STORAGE_UNAVAILABLE"
    assert "outage" in data["error"]["message"].lower()
    mock_session.rollback.assert_awaited()
    # Verify it NEVER switched to memory
    assert len(_memory_shops) == 0


@pytest.mark.asyncio
async def test_seller_service_refuses_memory_fallback_in_durable_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", True)

    service = SellerService(db=None)
    with pytest.raises(DurableStorageUnavailableError) as exc_info:
        await service.create_shop("owner-1", ShopInput(display_name="Shop 1"), "key-1")

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "DURABLE_STORAGE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_seller_shop_mutation_resolves_committed_same_key_result(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, verified_seller_identity: None
) -> None:
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", True)

    committed_shop_data = {
        "id": "shop-committed-1",
        "owner_id": "pilot_seller",
        "display_name": "Committed Shop",
        "created_at": "2026-10-24T12:00:00Z",
        "updated_at": "2026-10-24T12:00:00Z",
    }
    mock_record = MagicMock()
    mock_record.key = "pilot_seller:create_shop:replay-key-1"
    mock_record.response_json = json.dumps(committed_shop_data)
    mock_record.payload_hash = compute_payload_hash({"display_name": "Committed Shop"})
    mock_record.status_code = 200

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_record

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock(return_value=None)
    mock_session.close = AsyncMock(return_value=None)

    class MockSessionFactory:
        def __call__(self) -> MagicMock:
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=mock_session)
            ctx.__aexit__ = AsyncMock(return_value=None)
            return ctx

    monkeypatch.setattr("app.core.database.AsyncSessionLocal", MockSessionFactory())

    resp = await client.post(
        "/api/seller/shop",
        json={"display_name": "Committed Shop"},
        headers={"Authorization": "Bearer dev-pilot_seller", "Idempotency-Key": "replay-key-1"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["shop"]["id"] == "shop-committed-1"
    assert data["shop"]["display_name"] == "Committed Shop"
