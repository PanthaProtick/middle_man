import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import Settings, settings
from app.core.tokens import (
    LinkEncryptionKeyIncompatibleError,
    LinkEncryptionUnavailableError,
    _get_fernet_cipher,
    check_link_encryption_readiness,
    decrypt_token,
    encrypt_token,
    generate_portal_token_materials,
    inspect_link_encryption_compatibility,
    validate_link_encryption_config,
)
from app.models.entities import OrderTable
from app.services.order_mapping import to_seller_order


def test_order_link_encryption_configured_property() -> None:
    assert not Settings(ORDER_LINK_ENCRYPTION_KEY="").is_order_link_encryption_configured
    assert not Settings(ORDER_LINK_ENCRYPTION_KEY="   ").is_order_link_encryption_configured
    assert not Settings(ORDER_LINK_ENCRYPTION_KEY="your-encryption-key").is_order_link_encryption_configured
    assert not Settings(ORDER_LINK_ENCRYPTION_KEY="<encryption-key>").is_order_link_encryption_configured
    assert not Settings(ORDER_LINK_ENCRYPTION_KEY="placeholder").is_order_link_encryption_configured

    valid_settings = Settings(ORDER_LINK_ENCRYPTION_KEY="test-encryption-key-material-32bytes!")
    assert valid_settings.is_order_link_encryption_configured


def test_validate_link_encryption_config_diagnostics() -> None:
    valid, msg = validate_link_encryption_config(Settings(ORDER_LINK_ENCRYPTION_KEY=""))
    assert not valid
    assert "missing" in msg.lower()

    valid, msg = validate_link_encryption_config(Settings(ORDER_LINK_ENCRYPTION_KEY="your-encryption-key"))
    assert not valid
    assert "placeholder" in msg.lower()

    secret = "super-secret-production-key-material"
    valid, msg = validate_link_encryption_config(Settings(ORDER_LINK_ENCRYPTION_KEY=secret))
    assert valid
    assert msg == ""


def test_get_fernet_cipher_in_durable_mode_fails_closed_when_unconfigured() -> None:
    cfg = Settings(SELF_TEST_MODE=True, ORDER_LINK_ENCRYPTION_KEY="")
    assert cfg.is_durable_mode

    with pytest.raises(LinkEncryptionUnavailableError) as exc_info:
        _get_fernet_cipher(cfg)

    assert exc_info.value.status_code == 503
    detail = exc_info.value.detail
    assert isinstance(detail, dict)
    assert detail["code"] == "LINK_ENCRYPTION_UNAVAILABLE"


def test_get_fernet_cipher_does_not_disclose_secret_material_on_failure() -> None:
    secret = "custom-secret-key-that-must-not-leak"
    cfg = Settings(SELF_TEST_MODE=True, ORDER_LINK_ENCRYPTION_KEY="")
    with pytest.raises(LinkEncryptionUnavailableError) as exc_info:
        _get_fernet_cipher(cfg)

    detail_str = str(exc_info.value.detail)
    assert secret not in detail_str

    placeholder_secret = "invalid-placeholder-key-material"
    cfg_placeholder = Settings(SELF_TEST_MODE=True, ORDER_LINK_ENCRYPTION_KEY=placeholder_secret)
    with pytest.raises(LinkEncryptionUnavailableError) as exc_info2:
        _get_fernet_cipher(cfg_placeholder)

    detail_str2 = str(exc_info2.value.detail)
    assert placeholder_secret not in detail_str2


def test_get_fernet_cipher_in_offline_dev_mode_permits_standby_fallback() -> None:
    cfg = Settings(SELF_TEST_MODE=False, ENV="development", ORDER_LINK_ENCRYPTION_KEY="")
    assert not cfg.is_durable_mode

    cipher = _get_fernet_cipher(cfg)
    assert cipher is not None
    token = cipher.encrypt(b"hello")
    assert cipher.decrypt(token) == b"hello"


def test_cipher_is_independent_of_clerk_secret_key() -> None:
    key_material = "consistent-link-encryption-key-for-test"
    cfg1 = Settings(
        SELF_TEST_MODE=True,
        ORDER_LINK_ENCRYPTION_KEY=key_material,
        CLERK_SECRET_KEY="sk_test_first_clerk_key",
    )
    cfg2 = Settings(
        SELF_TEST_MODE=True,
        ORDER_LINK_ENCRYPTION_KEY=key_material,
        CLERK_SECRET_KEY="sk_test_second_clerk_key_after_rotation",
    )

    cipher1 = _get_fernet_cipher(cfg1)
    cipher2 = _get_fernet_cipher(cfg2)

    data = b"buyer-portal-token-12345"
    encrypted_with_1 = cipher1.encrypt(data)
    # Cipher 2 must decrypt data encrypted with Cipher 1 even though Clerk secret key changed
    assert cipher2.decrypt(encrypted_with_1) == data


def test_encrypt_and_decrypt_token_round_trip() -> None:
    cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="my-app-link-encryption-key-roundtrip")
    original = "opaque-token-sample-value-abc123xyz"
    encrypted = encrypt_token(original, cfg=cfg)
    assert encrypted != original
    decrypted = decrypt_token(encrypted, cfg=cfg)
    assert decrypted == original


def test_token_decryption_independent_of_clerk_secret_key() -> None:
    key_material = "shared-application-link-key-materials"
    cfg1 = Settings(ORDER_LINK_ENCRYPTION_KEY=key_material, CLERK_SECRET_KEY="sk_first_clerk_secret")
    cfg2 = Settings(ORDER_LINK_ENCRYPTION_KEY=key_material, CLERK_SECRET_KEY="sk_second_rotated_clerk_secret")

    token = "buyer-token-independence-verification"
    encrypted = encrypt_token(token, cfg=cfg1)
    # Decrypt with cfg2 where Clerk secret is different
    decrypted = decrypt_token(encrypted, cfg=cfg2)
    assert decrypted == token


def test_decrypt_token_with_incompatible_key_raises_explicit_503() -> None:
    cfg1 = Settings(ORDER_LINK_ENCRYPTION_KEY="key-one-alpha-version")
    cfg2 = Settings(ORDER_LINK_ENCRYPTION_KEY="key-two-beta-version-incompatible")

    encrypted = encrypt_token("sample-token", cfg=cfg1)

    with pytest.raises(LinkEncryptionKeyIncompatibleError) as exc_info:
        decrypt_token(encrypted, cfg=cfg2)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "LINK_ENCRYPTION_KEY_INCOMPATIBLE"
    # Ensure no secrets leak in the error message
    assert "key-two-beta" not in str(exc_info.value.detail)
    assert "sample-token" not in str(exc_info.value.detail)


def test_generate_portal_token_materials_round_trip() -> None:
    cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="portal-token-gen-key-test")
    raw_token, digest, encrypted = generate_portal_token_materials(cfg=cfg)

    import hashlib
    assert hashlib.sha256(raw_token.encode("utf-8")).hexdigest() == digest
    assert decrypt_token(encrypted, cfg=cfg) == raw_token


@pytest.mark.asyncio
async def test_inspect_link_encryption_compatibility_empty_db() -> None:
    cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="compatible-key-abc")
    session = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalars.return_value.all.return_value = []
    session.execute.return_value = exec_res

    # Should complete without raising any error
    await inspect_link_encryption_compatibility(session, cfg=cfg)


@pytest.mark.asyncio
async def test_inspect_link_encryption_compatibility_compatible_tokens() -> None:
    cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="compatible-key-abc")
    tok1 = encrypt_token("token-one", cfg=cfg)
    tok2 = encrypt_token("token-two", cfg=cfg)

    session = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalars.return_value.all.return_value = [tok1, tok2]
    session.execute.return_value = exec_res

    await inspect_link_encryption_compatibility(session, cfg=cfg)


@pytest.mark.asyncio
async def test_inspect_link_encryption_compatibility_incompatible_tokens() -> None:
    old_cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="old-deprecated-key")
    new_cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="new-active-key-mismatch")

    tok_old = encrypt_token("token-encrypted-with-old-key", cfg=old_cfg)

    session = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalars.return_value.all.return_value = [tok_old]
    session.execute.return_value = exec_res

    with pytest.raises(LinkEncryptionKeyIncompatibleError) as exc_info:
        await inspect_link_encryption_compatibility(session, cfg=new_cfg)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "LINK_ENCRYPTION_KEY_INCOMPATIBLE"


@pytest.mark.asyncio
async def test_check_link_encryption_readiness_fails_in_durable_mode_if_unconfigured() -> None:
    cfg = Settings(SELF_TEST_MODE=True, ORDER_LINK_ENCRYPTION_KEY="")
    with pytest.raises(LinkEncryptionUnavailableError) as exc_info:
        await check_link_encryption_readiness(cfg=cfg)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "LINK_ENCRYPTION_UNAVAILABLE"


@pytest.mark.asyncio
async def test_check_link_encryption_readiness_runs_compatibility_check_with_session() -> None:
    old_cfg = Settings(ORDER_LINK_ENCRYPTION_KEY="old-key")
    new_cfg = Settings(SELF_TEST_MODE=True, ORDER_LINK_ENCRYPTION_KEY="new-configured-key")

    tok_old = encrypt_token("old-token", cfg=old_cfg)

    session = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalars.return_value.all.return_value = [tok_old]
    session.execute.return_value = exec_res

    factory = MagicMock()
    # async context manager on factory()
    factory.return_value.__aenter__.return_value = session
    factory.return_value.__aexit__.return_value = None

    with pytest.raises(LinkEncryptionKeyIncompatibleError):
        await check_link_encryption_readiness(cfg=new_cfg, session_factory=factory)


def _build_test_order_row(encrypted_token: str) -> OrderTable:
    now = datetime.datetime.now(datetime.timezone.utc)
    row = OrderTable()
    row.id = uuid.uuid4()
    row.shop_id = uuid.uuid4()
    row.payment_account_id = uuid.uuid4()
    row.token_lookup_digest = "test-digest"
    row.encrypted_portal_token = encrypted_token
    row.product_name = "Synthetic Test Product"
    row.total_minor = 100000
    row.required_advance_minor = 20000
    row.account_provider = "bkash"
    row.account_receiving_number = "01711111111"
    row.account_label = "Test Account"
    row.lifecycle = "awaiting_buyer"
    row.version = 1
    row.created_at = now
    row.updated_at = now
    row.expires_at = now + datetime.timedelta(hours=48)
    row.completed_at = None
    row.predecessor_order_id = None
    row.replaced_by_order_id = None
    row.buyer_revision = None
    return row


def test_order_recovery_after_clerk_secret_rotation(monkeypatch: pytest.MonkeyPatch) -> None:
    app_key = "stable-application-link-key-material"
    raw_token = "buyer-portal-secret-token-xyz789"
    monkeypatch.setattr(settings, "ORDER_LINK_ENCRYPTION_KEY", app_key)
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_test_first_clerk_credential")

    encrypted = encrypt_token(raw_token, cfg=settings)
    row = _build_test_order_row(encrypted)

    # 1. Recover order with original Clerk secret key
    seller_order = to_seller_order(row)
    assert seller_order.portal_token == raw_token
    assert seller_order.portal_url == f"/orders/{raw_token}"

    # 2. Rotate Clerk secret key and verify recovery still works cleanly
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "sk_test_rotated_second_clerk_key")
    seller_order_rotated = to_seller_order(row)
    assert seller_order_rotated.portal_token == raw_token
    assert seller_order_rotated.portal_url == f"/orders/{raw_token}"

    # 3. Clerk secret key is completely cleared (e.g. decoupled / unset)
    monkeypatch.setattr(settings, "CLERK_SECRET_KEY", "")
    seller_order_cleared = to_seller_order(row)
    assert seller_order_cleared.portal_token == raw_token
    assert seller_order_cleared.portal_url == f"/orders/{raw_token}"


def test_order_recovery_fails_with_explicit_503_when_application_key_changed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_key_1 = "first-application-link-key"
    app_key_2 = "second-incompatible-application-link-key"
    raw_token = "buyer-portal-secret-token-fail-test"

    monkeypatch.setattr(settings, "ORDER_LINK_ENCRYPTION_KEY", app_key_1)
    encrypted = encrypt_token(raw_token, cfg=settings)
    row = _build_test_order_row(encrypted)

    # Switch to incompatible application key
    monkeypatch.setattr(settings, "ORDER_LINK_ENCRYPTION_KEY", app_key_2)

    with pytest.raises(LinkEncryptionKeyIncompatibleError) as exc_info:
        to_seller_order(row)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "LINK_ENCRYPTION_KEY_INCOMPATIBLE"


def test_order_record_is_preserved_never_reset_or_wiped(monkeypatch: pytest.MonkeyPatch) -> None:
    app_key_1 = "original-order-encryption-key"
    app_key_2 = "wrong-temp-order-encryption-key"
    raw_token = "preserve-me-intact-across-failures"

    monkeypatch.setattr(settings, "ORDER_LINK_ENCRYPTION_KEY", app_key_1)
    encrypted = encrypt_token(raw_token, cfg=settings)
    row = _build_test_order_row(encrypted)
    original_encrypted_stored = row.encrypted_portal_token

    # Change key to incompatible key
    monkeypatch.setattr(settings, "ORDER_LINK_ENCRYPTION_KEY", app_key_2)
    with pytest.raises(LinkEncryptionKeyIncompatibleError):
        to_seller_order(row)

    # Assert record in row is untouched and not overwritten
    assert row.encrypted_portal_token == original_encrypted_stored

    # Restore correct key
    monkeypatch.setattr(settings, "ORDER_LINK_ENCRYPTION_KEY", app_key_1)
    recovered = to_seller_order(row)
    assert recovered.portal_token == raw_token



