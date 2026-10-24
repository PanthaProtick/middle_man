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


@pytest.mark.asyncio
async def test_verify_marker_key_memory_binding_and_rotation_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.payment_marker_protection import _memory_keys, verify_marker_key
    from app.services.seller_service import SellerDomainException

    _memory_keys.clear()
    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "secret-key-alpha-32chars-long!!!")
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")

    # First verification binds shop_1 to key alpha
    await verify_marker_key(None, "shop_1")
    assert "shop_1" in _memory_keys

    # Same key succeeds
    await verify_marker_key(None, "shop_1")

    # Rotate marker secret without proper migration
    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "secret-key-bravo-32chars-long!!!")
    with pytest.raises(SellerDomainException) as exc_info:
        await verify_marker_key(None, "shop_1")

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "PAYMENT_MARKER_KEY_UNAVAILABLE"


@pytest.mark.asyncio
async def test_verify_marker_key_fails_closed_when_secret_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.payment_marker_protection import verify_marker_key
    from app.services.seller_service import SellerDomainException

    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "")
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/testdb")
    assert settings.is_database_configured

    with pytest.raises(SellerDomainException) as exc_info:
        await verify_marker_key(None, "shop_2")

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "PAYMENT_MARKER_KEY_UNAVAILABLE"


@pytest.mark.asyncio
async def test_reject_used_identity_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.payment_marker_protection import _memory_keys, reject_used_identity
    from app.services.reconciliation_store import _memory_used_payment_markers
    from app.services.seller_service import SellerDomainException

    _memory_keys.clear()
    _memory_used_payment_markers.clear()

    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "marker-secret-memory-test-12345")
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")

    # Identity not used yet -> succeeds
    await reject_used_identity(None, "shop_10", "bkash", "TRX_NEW_001")

    # Add marker to used payment markers
    digest = compute_payment_digest("shop_10", "bkash", "TRX_NEW_001")
    _memory_used_payment_markers.add(("shop_10", "bkash", digest))

    # Reject identity should now raise 409 PAYMENT_USED
    with pytest.raises(SellerDomainException) as exc_info:
        await reject_used_identity(None, "shop_10", "bkash", "TRX_NEW_001")

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["code"] == "PAYMENT_USED"


@pytest.mark.asyncio
async def test_verify_marker_key_db_historic_markers_mismatch_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.models.entities import ReceivedTransactionTable, UsedPaymentMarkerTable
    from app.services.payment_marker_protection import verify_marker_key
    from app.services.seller_service import SellerDomainException

    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", "new-active-secret-key-32chars!")
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")

    # Mock AsyncSession
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    exec_result = MagicMock()
    exec_result.all.return_value = [("bkash", "TRX_LEGACY_01")]
    mock_db.execute = AsyncMock(return_value=exec_result)

    # No existing binding in PaymentMarkerKeyTable
    mock_db.get = AsyncMock(return_value=None)

    # Historic marker exists under an old, different digest
    historic_marker = UsedPaymentMarkerTable(
        id="marker-1",
        shop_id="shop_legacy",
        provider="bkash",
        transaction_digest="old_incompatible_digest_value_that_does_not_match",
    )
    # Receipt exists
    receipt = ReceivedTransactionTable(
        id="rcpt-1",
        shop_id="shop_legacy",
        provider="bkash",
        trx_id="TRX_LEGACY_01",
    )

    scalars_mock = MagicMock()
    # First scalars call is for UsedPaymentMarkerTable, second is for ReceivedTransactionTable
    scalars_mock.all.side_effect = [[historic_marker], [receipt]]
    mock_db.scalars = AsyncMock(return_value=scalars_mock)

    with pytest.raises(SellerDomainException) as exc_info:
        await verify_marker_key(mock_db, "shop_legacy")

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "PAYMENT_MARKER_KEY_UNAVAILABLE"
    # Ensure db.add was NOT called to write an invalid key binding
    mock_db.add.assert_not_called()


@pytest.mark.asyncio
async def test_verify_marker_key_db_historic_markers_match_upgrades_binding(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.models.entities import ReceivedTransactionTable, UsedPaymentMarkerTable
    from app.models.structured_retention import PaymentMarkerKeyTable
    from app.services.payment_marker_protection import verify_marker_key

    secret = "matching-active-secret-key-32chars!"
    monkeypatch.setattr(settings, "PAYMENT_MARKER_SECRET", secret)
    monkeypatch.setattr(settings, "PAYMENT_IDENTITY_SECRET", "")

    # Mock AsyncSession
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    exec_result = MagicMock()
    exec_result.all.return_value = [("bkash", "TRX_VALID_01")]
    mock_db.execute = AsyncMock(return_value=exec_result)

    # No existing binding in PaymentMarkerKeyTable
    mock_db.get = AsyncMock(return_value=None)

    # Historic marker matches the digest computed with the active secret
    valid_digest = compute_payment_digest("shop_match", "bkash", "TRX_VALID_01")
    historic_marker = UsedPaymentMarkerTable(
        id="marker-valid-1",
        shop_id="shop_match",
        provider="bkash",
        transaction_digest=valid_digest,
    )
    receipt = ReceivedTransactionTable(
        id="rcpt-valid-1",
        shop_id="shop_match",
        provider="bkash",
        trx_id="TRX_VALID_01",
    )

    scalars_mock = MagicMock()
    scalars_mock.all.side_effect = [[historic_marker], [receipt]]
    mock_db.scalars = AsyncMock(return_value=scalars_mock)

    await verify_marker_key(mock_db, "shop_match")

    # Ensure db.add was called to establish the binding
    mock_db.add.assert_called_once()
    added_obj = mock_db.add.call_args[0][0]
    assert isinstance(added_obj, PaymentMarkerKeyTable)
    assert added_obj.shop_id == "shop_match"
    mock_db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_check_payment_marker_readiness_fails_closed_when_unconfigured() -> None:
    from app.services.payment_marker_protection import (
        PaymentMarkerKeyUnavailableError,
        check_payment_marker_readiness,
    )

    unconfigured_cfg = Settings(SELF_TEST_MODE=True, PAYMENT_MARKER_SECRET="")
    with pytest.raises(PaymentMarkerKeyUnavailableError) as exc_info:
        await check_payment_marker_readiness(cfg=unconfigured_cfg)

    err = str(exc_info.value).lower()
    assert "payment marker" in err
    assert "missing" in err


@pytest.mark.asyncio
async def test_check_payment_marker_readiness_skips_in_offline_dev() -> None:
    from app.services.payment_marker_protection import check_payment_marker_readiness

    offline_cfg = Settings(
        SELF_TEST_MODE=False,
        DATABASE_URL="",
        PGHOST="",
        PGUSER="",
        PAYMENT_MARKER_SECRET="",
    )
    # Should not raise in offline standby dev mode
    await check_payment_marker_readiness(cfg=offline_cfg)


@pytest.mark.asyncio
async def test_inspect_payment_marker_compatibility_passes_when_bindings_match() -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.models.structured_retention import PaymentMarkerKeyTable
    from app.services.payment_marker_protection import inspect_payment_marker_compatibility

    secret = "production-ready-startup-secret-32b!"
    cfg = Settings(SELF_TEST_MODE=True, PAYMENT_MARKER_SECRET=secret)
    expected_fp = compute_payment_digest("shop_startup_1", "marker-key-binding-v1", "key-check", secret=secret)
    binding = PaymentMarkerKeyTable(shop_id="shop_startup_1", fingerprint=expected_fp)

    mock_db = AsyncMock()
    scalars_mock = MagicMock()
    # First scalars call: bindings; second scalars call (if needed): unbound markers
    scalars_mock.all.side_effect = [[binding], []]
    mock_db.scalars = AsyncMock(return_value=scalars_mock)

    await inspect_payment_marker_compatibility(mock_db, cfg=cfg)


@pytest.mark.asyncio
async def test_inspect_payment_marker_compatibility_fails_on_mismatched_binding() -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.models.structured_retention import PaymentMarkerKeyTable
    from app.services.payment_marker_protection import (
        PaymentMarkerKeyIncompatibleError,
        inspect_payment_marker_compatibility,
    )

    secret = "production-ready-startup-secret-32b!"
    cfg = Settings(SELF_TEST_MODE=True, PAYMENT_MARKER_SECRET=secret)
    bad_binding = PaymentMarkerKeyTable(shop_id="shop_mismatch", fingerprint="stale_or_invalid_fp")

    mock_db = AsyncMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = [bad_binding]
    mock_db.scalars = AsyncMock(return_value=scalars_mock)

    with pytest.raises(PaymentMarkerKeyIncompatibleError) as exc_info:
        await inspect_payment_marker_compatibility(mock_db, cfg=cfg)

    assert "shop_mismatch" in str(exc_info.value)
    # Ensure secret material is not exposed
    assert secret not in str(exc_info.value)


@pytest.mark.asyncio
async def test_inspect_payment_marker_compatibility_fails_on_unbound_mismatched_marker() -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.models.entities import ReceivedTransactionTable, UsedPaymentMarkerTable
    from app.services.payment_marker_protection import (
        PaymentMarkerKeyIncompatibleError,
        inspect_payment_marker_compatibility,
    )

    secret = "production-ready-startup-secret-32b!"
    cfg = Settings(SELF_TEST_MODE=True, PAYMENT_MARKER_SECRET=secret)

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    exec_result = MagicMock()
    exec_result.all.return_value = [("bkash", "TRX_UNBOUND_01")]
    mock_db.execute = AsyncMock(return_value=exec_result)

    unbound_marker = UsedPaymentMarkerTable(
        id="marker-unbound-1",
        shop_id="shop_unbound",
        provider="bkash",
        transaction_digest="mismatched_historic_digest_here",
    )
    receipt = ReceivedTransactionTable(
        id="rcpt-unbound-1",
        shop_id="shop_unbound",
        provider="bkash",
        trx_id="TRX_UNBOUND_01",
    )

    scalars_mock = MagicMock()
    # 1. bindings (empty)
    # 2. unbound markers ([unbound_marker])
    # 3. receipts for shop_unbound ([receipt])
    scalars_mock.all.side_effect = [[], [unbound_marker], [receipt]]
    mock_db.scalars = AsyncMock(return_value=scalars_mock)

    with pytest.raises(PaymentMarkerKeyIncompatibleError) as exc_info:
        await inspect_payment_marker_compatibility(mock_db, cfg=cfg)

    assert "shop_unbound" in str(exc_info.value)
    assert secret not in str(exc_info.value)
