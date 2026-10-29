import pytest

from app.core.config import Settings, settings
from app.services.payment_marker_protection import (
    validate_payment_marker_config,
)
from app.services.reconciliation import compute_payment_digest


def test_payment_marker_protection_configured_property() -> None:
    assert not Settings(PAYMENT_MARKER_SECRET="").is_payment_marker_protection_configured
    assert not Settings(PAYMENT_MARKER_SECRET="   ").is_payment_marker_protection_configured
    assert not Settings(PAYMENT_MARKER_SECRET="your-marker-secret").is_payment_marker_protection_configured
    assert not Settings(PAYMENT_MARKER_SECRET="<payment-marker-secret>").is_payment_marker_protection_configured
    assert not Settings(PAYMENT_MARKER_SECRET="placeholder").is_payment_marker_protection_configured

    valid_settings = Settings(PAYMENT_MARKER_SECRET="marker-secret-dedicated-32-bytes-long!")
    assert valid_settings.is_payment_marker_protection_configured
    assert valid_settings.effective_payment_marker_secret == "marker-secret-dedicated-32-bytes-long!"


def test_payment_marker_identity_secret_alias_support() -> None:
    # If PAYMENT_MARKER_SECRET is empty but PAYMENT_IDENTITY_SECRET is provided
    alias_settings = Settings(PAYMENT_IDENTITY_SECRET="alias-payment-identity-secret-value")
    assert alias_settings.is_payment_marker_protection_configured
    assert alias_settings.effective_payment_marker_secret == "alias-payment-identity-secret-value"

    # Primary PAYMENT_MARKER_SECRET takes precedence
    both_settings = Settings(
        PAYMENT_MARKER_SECRET="primary-marker-secret",
        PAYMENT_IDENTITY_SECRET="alias-marker-secret",
    )
    assert both_settings.effective_payment_marker_secret == "primary-marker-secret"


def test_validate_payment_marker_config_diagnostics() -> None:
    valid, msg = validate_payment_marker_config(Settings(PAYMENT_MARKER_SECRET=""))
    assert not valid
    assert "missing" in msg.lower()

    valid, msg = validate_payment_marker_config(Settings(PAYMENT_MARKER_SECRET="your-marker-secret"))
    assert not valid
    assert "placeholder" in msg.lower()

    secret = "production-ready-payment-marker-secret-key"
    valid, msg = validate_payment_marker_config(Settings(PAYMENT_MARKER_SECRET=secret))
    assert valid
    assert msg == ""


def test_compute_payment_digest_independent_of_clerk_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    marker_secret = "dedicated-payment-marker-secret-xyz"
    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", marker_secret)
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")

    # Test with Clerk secret set to 'sk_live_alpha'
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_live_alpha")
    digest_alpha = compute_payment_digest("shop_100", "bkash", "TRX_ABC_123")

    # Rotate Clerk secret to 'sk_live_bravo'
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_live_bravo")
    digest_bravo = compute_payment_digest("shop_100", "bkash", "TRX_ABC_123")

    # Clear Clerk secret completely
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "")
    digest_empty_clerk = compute_payment_digest("shop_100", "bkash", "TRX_ABC_123")

    # The digest must remain identical regardless of Clerk credentials
    assert digest_alpha == digest_bravo
    assert digest_alpha == digest_empty_clerk

    # Changing the marker secret must produce a different digest
    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "different-marker-secret-456")
    digest_rotated_marker = compute_payment_digest("shop_100", "bkash", "TRX_ABC_123")
    assert digest_rotated_marker != digest_alpha


def test_compute_payment_digest_fails_closed_in_durable_or_db_mode_when_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "")
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_test_some_key")

    # Simulate database configured
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/testdb")
    assert settings.is_database_configured

    with pytest.raises(RuntimeError) as exc_info:
        compute_payment_digest("shop_100", "bkash", "TRX_FAIL_CLOSED")

    error_msg = str(exc_info.value)
    assert "payment marker" in error_msg.lower() or "secret" in error_msg.lower()
    # Ensure no secrets or sensitive internal strings are exposed
    assert "sk_test_some_key" not in error_msg


def test_compute_payment_digest_permits_standby_seed_in_offline_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "")
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")
    monkeypatch.setattr(settings, "DATABASE_URL", "")
    monkeypatch.setattr(settings, "PGHOST", "")
    monkeypatch.setattr(settings, "PGUSER", "")
    monkeypatch.setattr(settings, "ENV", "development")
    monkeypatch.setattr(settings, "SELF_TEST_MODE", False)

    assert not settings.is_database_configured
    assert not settings.is_durable_mode

    digest = compute_payment_digest("shop_100", "bkash", "TRX_STANDBY_DEV")
    assert isinstance(digest, str)
    assert len(digest) == 64  # sha256 hex digest
