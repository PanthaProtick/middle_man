import pytest

from app.core.config import settings
from app.services.reconciliation import compute_payment_digest


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
