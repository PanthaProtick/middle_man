"""Production readiness, secret isolation, seller-verification, and schema integrity validation."""

import logging
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.clerk_verifier import ClerkTokenVerifier
from app.core.config import Settings, settings
from app.core.database import DurableStorageUnavailableError, check_database_readiness
from app.core.schema import REQUIRED_SCHEMA_COLUMNS, check_schema_compatibility
from app.core.tokens import check_link_encryption_readiness
from app.services.payment_marker_protection import check_payment_marker_readiness

logger = logging.getLogger(__name__)

__all__ = [
    "ProductionReadinessError",
    "REQUIRED_SCHEMA_COLUMNS",
    "check_schema_compatibility",
    "validate_production_secrets",
    "validate_seller_auth_readiness",
    "check_production_readiness",
]


class ProductionReadinessError(RuntimeError):
    """Raised when application startup readiness checks fail."""

    def __init__(self, message: str, diagnostic: Optional[str] = None) -> None:
        self.message = message
        self.diagnostic = diagnostic
        super().__init__(f"{message}: {diagnostic}" if diagnostic else message)


def validate_production_secrets(cfg: Settings) -> None:
    """Verifies that secrets are configured, non-placeholder, and cryptographically independent."""
    courier_enabled = (
        cfg.PATHAO_PRODUCTION_BOOKING_ENABLED
        or cfg.PATHAO_LOCATION_ENVIRONMENT.strip().lower() != "offline"
    )
    if courier_enabled:
        courier_key = cfg.PATHAO_CREDENTIAL_ENCRYPTION_KEY.strip()
        if not courier_key or any(
            p in courier_key for p in ["your-pathao-credential-key", "your-credential-key"]
        ):
            raise ProductionReadinessError(
                "PATHAO_CREDENTIAL_ENCRYPTION_KEY is required when courier booking is enabled or location environment is not offline"
            )
        try:
            Fernet(courier_key.encode("ascii"))
        except Exception as exc:
            raise ProductionReadinessError(
                f"PATHAO_CREDENTIAL_ENCRYPTION_KEY must be a valid Fernet key: {exc}"
            )

    if not cfg.is_production:
        return

    link_key = cfg.ORDER_LINK_ENCRYPTION_KEY.strip()
    if not link_key or not cfg.is_order_link_encryption_configured:
        raise ProductionReadinessError(
            "ORDER_LINK_ENCRYPTION_KEY must be configured with a stable production key"
        )

    marker_secret = cfg.effective_payment_marker_secret.strip()
    if not marker_secret or not cfg.is_payment_marker_protection_configured:
        raise ProductionReadinessError(
            "PAYMENT_MARKER_SECRET must be configured with a stable production secret"
        )

    # Check pairwise independence across all configured production secrets
    active_secrets: list[tuple[str, str]] = [
        ("ORDER_LINK_ENCRYPTION_KEY", link_key),
        ("PAYMENT_MARKER_SECRET", marker_secret),
    ]
    if courier_enabled and cfg.PATHAO_CREDENTIAL_ENCRYPTION_KEY.strip():
        active_secrets.append(
            ("PATHAO_CREDENTIAL_ENCRYPTION_KEY", cfg.PATHAO_CREDENTIAL_ENCRYPTION_KEY.strip())
        )
    if cfg.CLERK_SECRET_KEY.strip():
        active_secrets.append(("CLERK_SECRET_KEY", cfg.CLERK_SECRET_KEY.strip()))
    if cfg.CLERK_JWT_KEY.strip():
        active_secrets.append(("CLERK_JWT_KEY", cfg.CLERK_JWT_KEY.strip()))

    for i in range(len(active_secrets)):
        for j in range(i + 1, len(active_secrets)):
            name1, val1 = active_secrets[i]
            name2, val2 = active_secrets[j]
            if val1 == val2:
                raise ProductionReadinessError(
                    f"{name1} and {name2} must be independent secrets"
                )


def validate_seller_auth_readiness(cfg: Settings, app: Optional[FastAPI] = None) -> None:
    """Validates live seller authentication configuration in production."""
    if not cfg.is_production:
        return

    if app is not None and bool(app.dependency_overrides):
        raise ProductionReadinessError(
            f"Production startup rejected: dependency_overrides are not permitted in production ({list(app.dependency_overrides.keys())})"
        )

    issuer = cfg.CLERK_ISSUER.strip()
    if not issuer:
        raise ProductionReadinessError("CLERK_ISSUER must be configured in production")
    if not issuer.startswith("https://"):
        raise ProductionReadinessError("CLERK_ISSUER must use https:// protocol in production")
    if ".clerk.accounts.dev" in issuer:
        raise ProductionReadinessError(
            f"Development Clerk issuer is not permitted in production: {issuer}"
        )
    if any(p in issuer for p in ["clerk.your-domain.com", "your-clerk-issuer"]):
        raise ProductionReadinessError(
            f"Placeholder Clerk issuer is not permitted in production: {issuer}"
        )

    secret_key = cfg.CLERK_SECRET_KEY.strip()
    if secret_key:
        if secret_key.startswith("sk_test_"):
            raise ProductionReadinessError(
                "Development Clerk secret key (sk_test_*) is not permitted in production"
            )
        if any(p in secret_key for p in ["your-clerk-secret-key", "your-secret-key"]):
            raise ProductionReadinessError("Placeholder Clerk secret key is not permitted in production")

    pub_key = cfg.CLERK_PUBLISHABLE_KEY.strip()
    if pub_key:
        if pub_key.startswith("pk_test_"):
            raise ProductionReadinessError(
                "Development Clerk publishable key (pk_test_*) is not permitted in production"
            )
        if any(p in pub_key for p in ["your-clerk-publishable-key", "your-publishable-key"]):
            raise ProductionReadinessError("Placeholder Clerk publishable key is not permitted in production")

    jwt_key = cfg.CLERK_JWT_KEY.strip()
    if jwt_key:
        if "your-clerk-jwt-key" in jwt_key:
            raise ProductionReadinessError("Placeholder Clerk JWT key is not permitted in production")
        try:
            loaded = load_pem_public_key(jwt_key.encode("utf-8"))
            if not isinstance(loaded, rsa.RSAPublicKey):
                raise ProductionReadinessError("CLERK_JWT_KEY must be an RSA public key in PEM format")
        except Exception as exc:
            raise ProductionReadinessError(f"CLERK_JWT_KEY is not a valid PEM public key: {exc}")

    try:
        ClerkTokenVerifier(
            issuer=issuer,
            jwt_key_pem=jwt_key or None,
            authorized_party=cfg.CLERK_AUTHORIZED_PARTY or None,
            audience=cfg.CLERK_AUDIENCE or None,
        )
    except Exception as exc:
        raise ProductionReadinessError(f"Clerk token verifier initialization failed: {exc}")


async def check_production_readiness(
    cfg: Optional[Settings] = None,
    app: Optional[FastAPI] = None,
    session_factory: Optional[async_sessionmaker[AsyncSession]] = None,
) -> None:
    """Master readiness check for production startup."""
    active_cfg = cfg or settings

    # 1. Secret independence and presence
    validate_production_secrets(active_cfg)

    # 2. Seller auth configuration and overrides
    validate_seller_auth_readiness(active_cfg, app=app)

    # 3. Durable storage and deep schema compatibility
    readiness = await check_database_readiness(cfg=active_cfg, session_factory=session_factory)
    if not readiness.is_ready:
        raise DurableStorageUnavailableError(
            message=f"Durable storage initialization failed: {readiness.diagnostic}"
        )

    # 4. Order link encryption compatibility
    await check_link_encryption_readiness()

    # 5. Payment marker protection compatibility
    await check_payment_marker_readiness()
