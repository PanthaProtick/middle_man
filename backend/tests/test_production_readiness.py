from unittest.mock import AsyncMock, MagicMock

import pytest
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI, Request

from app.core.auth import AuthenticationError, get_seller_identity
from app.core.config import Settings
from app.core.database import DatabaseReadinessStatus, DurableStorageUnavailableError
from app.core.readiness import (
    ProductionReadinessError,
    check_production_readiness,
    validate_production_secrets,
    validate_seller_auth_readiness,
)


@pytest.fixture
def valid_rsa_pem() -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")


@pytest.fixture
def valid_fernet_key() -> str:
    return Fernet.generate_key().decode("ascii")


def test_production_secrets_missing_or_placeholder() -> None:
    # Missing link key
    s1 = Settings(ENV="production", ORDER_LINK_ENCRYPTION_KEY="", PAYMENT_MARKER_SECRET="marker_sec_123")
    with pytest.raises(ProductionReadinessError, match="ORDER_LINK_ENCRYPTION_KEY"):
        validate_production_secrets(s1)

    # Placeholder link key
    s2 = Settings(ENV="production", ORDER_LINK_ENCRYPTION_KEY="your-encryption-key", PAYMENT_MARKER_SECRET="marker_sec_123")
    with pytest.raises(ProductionReadinessError, match="ORDER_LINK_ENCRYPTION_KEY"):
        validate_production_secrets(s2)

    # Missing marker secret
    s3 = Settings(ENV="production", ORDER_LINK_ENCRYPTION_KEY="link_sec_123", PAYMENT_MARKER_SECRET="")
    with pytest.raises(ProductionReadinessError, match="PAYMENT_MARKER_SECRET"):
        validate_production_secrets(s3)

    # Shared secrets
    s4 = Settings(ENV="production", ORDER_LINK_ENCRYPTION_KEY="same_secret_123", PAYMENT_MARKER_SECRET="same_secret_123")
    with pytest.raises(ProductionReadinessError, match="independent"):
        validate_production_secrets(s4)


def test_conditional_courier_key(valid_fernet_key: str) -> None:
    # Disabled courier: no key required
    s_off = Settings(
        ENV="production",
        ORDER_LINK_ENCRYPTION_KEY="link_key_unique",
        PAYMENT_MARKER_SECRET="marker_key_unique",
        PATHAO_PRODUCTION_BOOKING_ENABLED=False,
        PATHAO_LOCATION_ENVIRONMENT="offline",
        PATHAO_CREDENTIAL_ENCRYPTION_KEY="",
    )
    validate_production_secrets(s_off)

    # Enabled courier: missing key fails
    s_on_missing = Settings(
        ENV="production",
        ORDER_LINK_ENCRYPTION_KEY="link_key_unique",
        PAYMENT_MARKER_SECRET="marker_key_unique",
        PATHAO_PRODUCTION_BOOKING_ENABLED=True,
        PATHAO_CREDENTIAL_ENCRYPTION_KEY="",
    )
    with pytest.raises(ProductionReadinessError, match="PATHAO_CREDENTIAL_ENCRYPTION_KEY is required"):
        validate_production_secrets(s_on_missing)

    # Enabled courier: invalid key fails
    s_on_invalid = Settings(
        ENV="production",
        ORDER_LINK_ENCRYPTION_KEY="link_key_unique",
        PAYMENT_MARKER_SECRET="marker_key_unique",
        PATHAO_PRODUCTION_BOOKING_ENABLED=True,
        PATHAO_CREDENTIAL_ENCRYPTION_KEY="not-a-fernet-key",
    )
    with pytest.raises(ProductionReadinessError, match="valid Fernet key"):
        validate_production_secrets(s_on_invalid)

    # Enabled courier: colliding key fails
    s_on_collide = Settings(
        ENV="production",
        ORDER_LINK_ENCRYPTION_KEY=valid_fernet_key,
        PAYMENT_MARKER_SECRET="marker_key_unique",
        PATHAO_PRODUCTION_BOOKING_ENABLED=True,
        PATHAO_CREDENTIAL_ENCRYPTION_KEY=valid_fernet_key,
    )
    with pytest.raises(ProductionReadinessError, match="independent"):
        validate_production_secrets(s_on_collide)

    # Enabled courier with valid key passes
    s_on_valid = Settings(
        ENV="production",
        ORDER_LINK_ENCRYPTION_KEY="link_key_unique",
        PAYMENT_MARKER_SECRET="marker_key_unique",
        PATHAO_PRODUCTION_BOOKING_ENABLED=True,
        PATHAO_CREDENTIAL_ENCRYPTION_KEY=valid_fernet_key,
    )
    validate_production_secrets(s_on_valid)


def test_production_seller_auth_rejections(valid_rsa_pem: str) -> None:
    # Missing issuer
    s1 = Settings(ENV="production", CLERK_ISSUER="")
    with pytest.raises(ProductionReadinessError, match="CLERK_ISSUER must be configured"):
        validate_seller_auth_readiness(s1)

    # Non-https issuer
    s2 = Settings(ENV="production", CLERK_ISSUER="http://clerk.example.com")
    with pytest.raises(ProductionReadinessError, match="https://"):
        validate_seller_auth_readiness(s2)

    # Dev issuer (.clerk.accounts.dev)
    s3 = Settings(ENV="production", CLERK_ISSUER="https://patient-dog.clerk.accounts.dev")
    with pytest.raises(ProductionReadinessError, match="Development Clerk issuer"):
        validate_seller_auth_readiness(s3)

    # sk_test_* secret key
    s4 = Settings(ENV="production", CLERK_ISSUER="https://clerk.prod.com", CLERK_SECRET_KEY="sk_test_123")
    with pytest.raises(ProductionReadinessError, match="sk_test_"):
        validate_seller_auth_readiness(s4)

    # pk_test_* publishable key
    s5 = Settings(ENV="production", CLERK_ISSUER="https://clerk.prod.com", CLERK_PUBLISHABLE_KEY="pk_test_123")
    with pytest.raises(ProductionReadinessError, match="pk_test_"):
        validate_seller_auth_readiness(s5)

    # Invalid PEM JWT key
    s6 = Settings(ENV="production", CLERK_ISSUER="https://clerk.prod.com", CLERK_JWT_KEY="bad-pem")
    with pytest.raises(ProductionReadinessError, match="not a valid PEM"):
        validate_seller_auth_readiness(s6)

    # Valid config passes
    s7 = Settings(
        ENV="production",
        CLERK_ISSUER="https://clerk.prod.com",
        CLERK_SECRET_KEY="sk_live_123",
        CLERK_PUBLISHABLE_KEY="pk_live_123",
        CLERK_JWT_KEY=valid_rsa_pem,
    )
    validate_seller_auth_readiness(s7)


def test_production_rejects_app_dependency_overrides() -> None:
    test_app = FastAPI()
    test_app.dependency_overrides["dummy"] = lambda: "mock"
    s = Settings(ENV="production", CLERK_ISSUER="https://clerk.prod.com")
    with pytest.raises(ProductionReadinessError, match="dependency_overrides are not permitted"):
        validate_seller_auth_readiness(s, app=test_app)


def test_offline_dev_standby_allowed() -> None:
    s_dev = Settings(
        ENV="development",
        CLERK_ISSUER="https://patient-dog.clerk.accounts.dev",
        CLERK_SECRET_KEY="sk_test_123",
        ORDER_LINK_ENCRYPTION_KEY="your-encryption-key",
        PAYMENT_MARKER_SECRET="your-marker-secret",
    )
    validate_seller_auth_readiness(s_dev)
    validate_production_secrets(s_dev)


@pytest.mark.asyncio
async def test_production_readiness_storage_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    s = Settings(
        ENV="production",
        CLERK_ISSUER="https://clerk.prod.com",
        ORDER_LINK_ENCRYPTION_KEY="valid_link_secret",
        PAYMENT_MARKER_SECRET="valid_marker_secret",
    )
    monkeypatch.setattr(
        "app.core.readiness.check_database_readiness",
        AsyncMock(return_value=DatabaseReadinessStatus(is_ready=False, diagnostic="Postgres unreachable")),
    )
    with pytest.raises(DurableStorageUnavailableError, match="Postgres unreachable"):
        await check_production_readiness(cfg=s)


@pytest.mark.asyncio
async def test_auth_token_rejection_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.auth.settings.ENV", "production")
    req = MagicMock(spec=Request)

    with pytest.raises(AuthenticationError, match="Development seller tokens are not permitted"):
        await get_seller_identity(req, authorization="Bearer mock-seller-token")

    with pytest.raises(AuthenticationError, match="Development seller tokens are not permitted"):
        await get_seller_identity(req, authorization="Bearer dev-seller-1")
