from unittest.mock import AsyncMock, MagicMock

import pytest

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
