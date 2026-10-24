import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.core.database import (
    EXPECTED_SCHEMA_TABLES,
    DurableStorageUnavailableError,
    check_database_readiness,
    check_schema_inventory,
    get_db,
    sanitize_db_url,
    validate_database_config,
)
from app.main import app, lifespan
from app.models.seller import ShopInput
from app.services.seller_service import (
    SellerService,
    _memory_shops,
    compute_payload_hash,
    reset_memory_store,
)


def test_durable_mode_configuration_flags() -> None:
    # Offline default
    s_default = Settings(ENV="development", SELF_TEST_MODE=False)
    assert s_default.is_durable_mode is False

    # Explicit self-test integration mode
    s_self_test = Settings(ENV="development", SELF_TEST_MODE=True)
    assert s_self_test.is_durable_mode is True

    # Production environment always requires durable persistence
    s_prod = Settings(ENV="production")
    assert s_prod.is_durable_mode is True


def test_database_url_credential_sanitization() -> None:
    raw_url = "postgresql+asyncpg://app_user:secret_password_123@ep-sample.us-east-2.aws.neon.tech:5432/neondb?sslmode=require"
    sanitized = sanitize_db_url(raw_url)
    assert "secret_password_123" not in sanitized
    assert "app_user:***@ep-sample" in sanitized

    plain = "postgresql://seller_admin:very_secret_pwd@localhost:5432/middle_man"
    assert "very_secret_pwd" not in sanitize_db_url(plain)
    assert "seller_admin:***@localhost" in sanitize_db_url(plain)

    assert sanitize_db_url("") == ""
    assert sanitize_db_url(None) == ""


def test_validate_database_config_diagnostics() -> None:
    s_missing = Settings(DATABASE_URL="")
    valid, diag = validate_database_config(s_missing)
    assert valid is False
    assert "missing" in diag.lower()
    assert "DATABASE_URL" in diag

    s_placeholder = Settings(DATABASE_URL="postgresql+asyncpg://user:npg_password@ep-sample.us-east-2.aws.neon.tech/neondb")
    valid, diag = validate_database_config(s_placeholder)
    assert valid is False
    assert "placeholder" in diag.lower()
    assert "npg_password" not in diag

    s_valid = Settings(DATABASE_URL="postgresql+asyncpg://test_user:real_pw@localhost:5432/testdb")
    valid, diag = validate_database_config(s_valid)
    assert valid is True
    assert diag == ""


@pytest.mark.asyncio
async def test_startup_fails_closed_in_durable_mode_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", True)
    monkeypatch.setattr("app.core.database.AsyncSessionLocal", None)

    with pytest.raises(DurableStorageUnavailableError) as exc_info:
        async with lifespan(app):
            pass

    err = exc_info.value
    assert err.status_code == 503
    assert err.detail["code"] == "DURABLE_STORAGE_UNAVAILABLE"
    assert "initialization failed" in err.detail["message"].lower()


@pytest.mark.asyncio
async def test_startup_succeeds_in_offline_mode_without_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", False)
    monkeypatch.setattr("app.core.config.settings.ENV", "test")
    monkeypatch.setattr("app.core.database.AsyncSessionLocal", None)

    async with lifespan(app):
        assert True


@pytest.mark.asyncio
async def test_get_db_in_durable_mode_raises_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", True)
    monkeypatch.setattr("app.core.database.AsyncSessionLocal", None)

    with pytest.raises(DurableStorageUnavailableError) as exc_info:
        gen = get_db()
        await anext(gen)

    err = exc_info.value
    assert err.status_code == 503
    assert err.detail["code"] == "DURABLE_STORAGE_UNAVAILABLE"
    assert "durable storage is required" in err.detail["message"].lower()


@pytest.mark.asyncio
async def test_get_db_in_offline_mode_yields_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.config.settings.SELF_TEST_MODE", False)
    monkeypatch.setattr("app.core.config.settings.ENV", "test")
    monkeypatch.setattr("app.core.database.AsyncSessionLocal", None)

    gen = get_db()
    result = await anext(gen)
    assert result is None


@pytest.mark.asyncio
async def test_check_database_readiness_unconfigured() -> None:
    cfg = Settings(DATABASE_URL="", SELF_TEST_MODE=True)
    status = await check_database_readiness(cfg=cfg, session_factory=None)
    assert status.is_ready is False
    assert "missing" in status.diagnostic.lower()


@pytest.mark.asyncio
async def test_seller_shop_mutation_blocks_in_durable_mode_when_db_unconfigured(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
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
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
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
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
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


@pytest.mark.asyncio
async def test_check_schema_inventory_detects_missing_tables() -> None:
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [("shops",), ("orders",)]
    mock_session = AsyncMock()
    mock_session.execute.return_value = mock_result

    all_present, missing = await check_schema_inventory(mock_session)
    assert all_present is False
    assert "payment_accounts" in missing
    assert "idempotency_records" in missing
    assert "shops" not in missing
    assert "orders" not in missing


@pytest.mark.asyncio
async def test_check_schema_inventory_all_present() -> None:
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [(table_name,) for table_name in EXPECTED_SCHEMA_TABLES]
    mock_session = AsyncMock()
    mock_session.execute.return_value = mock_result

    all_present, missing = await check_schema_inventory(mock_session)
    assert all_present is True
    assert len(missing) == 0
