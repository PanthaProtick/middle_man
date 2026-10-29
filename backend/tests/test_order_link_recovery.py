import datetime
import uuid

import pytest

from app.core.config import settings
from app.core.tokens import LinkEncryptionKeyIncompatibleError, encrypt_token
from app.models.entities import OrderTable
from app.services.order_mapping import to_seller_order


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
