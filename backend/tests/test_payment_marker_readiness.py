import pytest

from app.core.config import Settings
from app.services.reconciliation import compute_payment_digest


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
