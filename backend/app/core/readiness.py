"""Production readiness, secret isolation, seller-verification, and schema integrity validation."""

import logging
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings, settings
from app.core.database import (
    EXPECTED_SCHEMA_TABLES,
    DurableStorageUnavailableError,
    check_database_readiness,
    sanitize_db_url,
)
from app.core.migration_ledger import verify_ledger_integrity
from app.core.migration_types import MigrationError, MigrationRecord
from app.core.migrations import DEFAULT_MIGRATIONS_DIR, load_disk_migrations
from app.core.tokens import check_link_encryption_readiness
from app.services.payment_marker_protection import check_payment_marker_readiness

logger = logging.getLogger(__name__)

REQUIRED_SCHEMA_COLUMNS: dict[str, list[str]] = {
    "shops": ["id", "owner_id", "display_name"],
    "payment_accounts": ["id", "shop_id", "provider", "receiving_number", "label", "is_active", "version"],
    "orders": [
        "id",
        "shop_id",
        "payment_account_id",
        "token_lookup_digest",
        "encrypted_portal_token",
        "lifecycle",
        "version",
        "buyer_link_revoked_at",
    ],
    "buyer_revisions": ["id", "order_id", "revision_number", "contact_number_canonical", "payment_trx_id"],
    "used_payment_markers": ["id", "shop_id", "provider", "transaction_digest"],
    "received_transactions": ["id", "shop_id", "provider", "trx_id"],
    "idempotency_records": ["key", "scope", "operation"],
    "payment_marker_keys": ["shop_id", "fingerprint"],
    "courier_drafts": ["order_id", "version"],
    "pathao_connection_revisions": ["shop_id", "environment", "version"],
}


class ProductionReadinessError(RuntimeError):
    """Raised when application startup readiness checks fail."""

    def __init__(self, message: str, diagnostic: Optional[str] = None) -> None:
        self.message = message
        self.diagnostic = diagnostic
        super().__init__(f"{message}: {diagnostic}" if diagnostic else message)


def validate_production_secrets(cfg: Settings) -> None:
    """Verifies that secrets are configured, non-placeholder, and independent."""
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
        unrelated = (
            cfg.ORDER_LINK_ENCRYPTION_KEY.strip(),
            cfg.effective_payment_marker_secret.strip(),
            cfg.CLERK_SECRET_KEY.strip(),
            cfg.CLERK_JWT_KEY.strip(),
        )
        if courier_key in unrelated:
            raise ProductionReadinessError(
                "PATHAO_CREDENTIAL_ENCRYPTION_KEY must be independent of application and authentication secrets"
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

    if link_key == marker_secret:
        raise ProductionReadinessError(
            "ORDER_LINK_ENCRYPTION_KEY and PAYMENT_MARKER_SECRET must be independent secrets"
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


async def check_schema_compatibility(session: AsyncSession) -> tuple[bool, str]:
    """Verifies schema table presence, column presence, and migration ledger alignment."""
    # 1. Table inventory check
    t_stmt = text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()"
    )
    t_res = await session.execute(t_stmt)
    existing_tables = {str(row[0]) for row in t_res.fetchall()}

    missing_tables = [t for t in EXPECTED_SCHEMA_TABLES if t not in existing_tables]
    if missing_tables:
        return False, f"Database schema incomplete; missing tables: {', '.join(sorted(missing_tables))}"

    if "schema_migrations" not in existing_tables:
        return False, "Database schema incomplete; missing migration ledger table 'schema_migrations'"

    # 2. Required columns check
    c_stmt = text(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()"
    )
    c_res = await session.execute(c_stmt)
    existing_cols: dict[str, set[str]] = {}
    for t_name, c_name in c_res.fetchall():
        existing_cols.setdefault(str(t_name), set()).add(str(c_name))

    missing_cols: list[str] = []
    for tbl, cols in REQUIRED_SCHEMA_COLUMNS.items():
        tbl_cols = existing_cols.get(tbl, set())
        for col in cols:
            if col not in tbl_cols:
                missing_cols.append(f"{tbl}.{col}")
    if missing_cols:
        return False, f"Database schema incomplete; missing required columns: {', '.join(sorted(missing_cols))}"

    # 3. Migration ledger and pending checks
    try:
        m_stmt = text(
            "SELECT version, checksum, applied_at, execution_time_ms FROM schema_migrations ORDER BY version ASC"
        )
        m_res = await session.execute(m_stmt)
        applied = [
            MigrationRecord(
                version=str(r[0]),
                checksum=str(r[1]),
                applied_at=str(r[2]),
                execution_time_ms=int(r[3]),
            )
            for r in m_res.fetchall()
        ]
        disk = load_disk_migrations(DEFAULT_MIGRATIONS_DIR)
        pending = verify_ledger_integrity(applied, disk)
        if pending:
            pending_versions = [p.version for p in pending]
            return False, f"Database schema is behind migrations: missing {len(pending)} unapplied migration(s) ({pending_versions[:3]})"
    except MigrationError as m_exc:
        return False, f"Migration ledger integrity check failed: {m_exc}"
    except Exception as exc:
        sanitized = sanitize_db_url(str(exc))
        return False, f"Migration ledger query failed: {sanitized}"

    return True, ""


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
