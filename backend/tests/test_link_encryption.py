import pytest

from app.core.config import Settings
from app.core.tokens import (
    LinkEncryptionKeyIncompatibleError,
    LinkEncryptionUnavailableError,
    _get_fernet_cipher,
    decrypt_token,
    encrypt_token,
    generate_portal_token_materials,
    validate_link_encryption_config,
)


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
