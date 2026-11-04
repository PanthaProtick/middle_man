"""Hosted development shares production safeguards; no external services are used."""
from unittest.mock import AsyncMock

import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI
from pydantic import ValidationError
from starlette.requests import Request
from test_seller_auth_integration import _generate_rsa_key_pair, _make_token

from app.core import auth
from app.core.config import Settings
from app.core.database import DurableStorageUnavailableError, ensure_durable_storage
from app.core.public_gate import PublicAccessGateError, verify_public_access_gate
from app.core.readiness import (
    ProductionReadinessError,
    check_production_readiness,
    validate_production_secrets,
    validate_seller_auth_readiness,
)


def hosted_settings(**overrides):
    values = dict(
        ENV="hosted-development", VERCEL_ENV="production", SELF_TEST_MODE=False,
        CLERK_ISSUER="https://demo.clerk.accounts.dev",
        CLERK_PUBLISHABLE_KEY="pk_test_synthetic", CLERK_SECRET_KEY="sk_test_synthetic",
        CLERK_AUTHORIZED_PARTY="https://demo.example", CORS_ORIGINS=["https://demo.example"],
        ORDER_LINK_ENCRYPTION_KEY=Fernet.generate_key().decode(),
        PAYMENT_MARKER_SECRET="independent-demo-marker-secret",
        PATHAO_CREDENTIAL_ENCRYPTION_KEY=Fernet.generate_key().decode(),
        PATHAO_PRODUCTION_BOOKING_ENABLED=True, PATHAO_LOCATION_ENVIRONMENT="production",
        GEMINI_API_KEY="synthetic-gemini-key", REVIEW_GEMINI_ENABLED=True,
    )
    return Settings(_env_file=None, **(values | overrides))


def test_explicit_hosted_development_supports_live_providers_with_durable_security(monkeypatch):
    cfg = hosted_settings()
    assert not cfg.is_production
    assert cfg.requires_hosted_security and cfg.is_durable_mode
    assert cfg.is_gemini_configured and cfg.REVIEW_GEMINI_ENABLED
    validate_production_secrets(cfg)
    validate_seller_auth_readiness(cfg)
    monkeypatch.setattr("app.core.database.settings", cfg)
    with pytest.raises(DurableStorageUnavailableError):
        ensure_durable_storage(None, "hosted development")
    # Turning off bookings must never turn off durable storage or authentication.
    assert hosted_settings(PATHAO_PRODUCTION_BOOKING_ENABLED=False).is_durable_mode


@pytest.mark.parametrize("overrides", [
    {"VERCEL_ENV": "preview"}, {"SELF_TEST_MODE": True},
])
def test_hosted_development_cannot_be_a_disposable_preview_or_self_test(overrides):
    with pytest.raises(ValidationError):
        hosted_settings(**overrides)


@pytest.mark.parametrize("overrides", [
    {"CLERK_ISSUER": ""}, {"CLERK_ISSUER": "http://demo.clerk.accounts.dev"},
    {"CLERK_AUTHORIZED_PARTY": ""}, {"CLERK_AUTHORIZED_PARTY": "https://foreign.example"},
    {"CORS_ORIGINS": ["*"]}, {"CORS_ORIGINS": ["http://localhost:5173"]},
    {"CLERK_JWT_KEY": "invalid-pem"},
])
def test_hosted_development_retains_exact_session_trust(overrides):
    with pytest.raises(ProductionReadinessError):
        validate_seller_auth_readiness(hosted_settings(**overrides))


@pytest.mark.parametrize("overrides", [
    {"ORDER_LINK_ENCRYPTION_KEY": ""}, {"PAYMENT_MARKER_SECRET": ""},
    {"PATHAO_CREDENTIAL_ENCRYPTION_KEY": ""},
    {"ORDER_LINK_ENCRYPTION_KEY": "shared", "PAYMENT_MARKER_SECRET": "shared"},
])
def test_hosted_development_retains_required_independent_secrets(overrides):
    with pytest.raises(ProductionReadinessError):
        validate_production_secrets(hosted_settings(**overrides))


def test_hosted_development_forbids_startup_dependency_overrides():
    app = FastAPI()
    app.dependency_overrides[verify_public_access_gate] = lambda: True
    with pytest.raises(ProductionReadinessError, match="dependency_overrides"):
        validate_seller_auth_readiness(hosted_settings(), app)


async def test_hosted_development_fails_closed_without_database():
    with pytest.raises(DurableStorageUnavailableError):
        await check_production_readiness(hosted_settings(DATABASE_URL="", PGHOST=""))


async def test_hosted_development_runs_full_readiness_chain(monkeypatch):
    from app.core import readiness
    from app.core.database import DatabaseReadinessStatus

    database = AsyncMock(return_value=DatabaseReadinessStatus(is_ready=True))
    links, payments = AsyncMock(), AsyncMock()
    monkeypatch.setattr(readiness, "check_database_readiness", database)
    monkeypatch.setattr(readiness, "check_link_encryption_readiness", links)
    monkeypatch.setattr(readiness, "check_payment_marker_readiness", payments)
    await check_production_readiness(hosted_settings())
    database.assert_awaited_once()
    links.assert_awaited_once()
    payments.assert_awaited_once()


async def test_hosted_development_requires_explicit_buyer_policy(monkeypatch):
    monkeypatch.setattr("app.core.public_gate.settings", hosted_settings())
    with pytest.raises(PublicAccessGateError):
        await verify_public_access_gate()
    monkeypatch.setattr("app.core.public_gate.settings", hosted_settings(
        PRODUCTION_BUYER_ACCESS_POLICY="link_possession",
    ))
    assert await verify_public_access_gate()


async def test_hosted_development_verifies_distinct_seller_subjects(monkeypatch):
    cfg = hosted_settings()
    private_key, jwk = _generate_rsa_key_pair()
    monkeypatch.setattr(auth, "settings", cfg)
    monkeypatch.setattr(auth, "_clerk_verifier", auth.ClerkTokenVerifier(
        issuer=cfg.CLERK_ISSUER, authorized_party=cfg.CLERK_AUTHORIZED_PARTY,
        jwks={"keys": [jwk]},
    ))
    request = Request({"type": "http", "headers": [(b"x-seller-id", b"foreign-seller")]})
    for subject in ("seller-alpha", "seller-beta"):
        token = _make_token(private_key, subject, cfg.CLERK_ISSUER, azp=cfg.CLERK_AUTHORIZED_PARTY)
        identity = await auth.get_seller_identity(request, f"Bearer {token}")
        assert identity.owner_id == subject
    for token in ("dev-seller-alpha", "mock-seller-token"):
        with pytest.raises(auth.AuthenticationError):
            await auth.get_seller_identity(request, f"Bearer {token}")


async def test_hosted_development_rejects_runtime_identity_override(client, monkeypatch):
    from app.main import app

    monkeypatch.setattr("app.main.settings", hosted_settings())
    app.dependency_overrides[auth.get_seller_identity] = lambda: auth.SellerIdentity(owner_id="forged")
    try:
        response = await client.get("/api/seller/shop")
        assert response.status_code == 401
    finally:
        app.dependency_overrides.pop(auth.get_seller_identity, None)
