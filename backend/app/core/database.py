import logging
import re
from dataclasses import dataclass
from typing import AsyncGenerator, Optional

import asyncpg
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import Settings, settings
from app.core.database_engine import create_database_engine

logger = logging.getLogger(__name__)


def sanitize_db_url(url: Optional[str]) -> str:
    """Masks database credentials from connection strings for diagnostics and logging."""
    if not url:
        return ""
    return re.sub(r"://([^:@/]+):([^@/]+)@", r"://\1:***@", url)


def validate_database_config(cfg: Settings) -> tuple[bool, str]:
    """Validates database configuration for durable operation without disclosing credentials."""
    url = cfg.effective_database_url
    if not url:
        return False, "Database configuration is missing. Set DATABASE_URL or PG* environment variables."
    if not cfg.is_database_configured:
        return False, "Database configuration contains placeholder values. Set a non-placeholder Neon or PostgreSQL connection string."
    return True, ""


class DurableStorageUnavailableError(HTTPException):
    def __init__(
        self,
        message: str = "Durable storage is required in integration mode, but the database is unavailable.",
        *,
        diagnostic: Optional[str] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        full_msg = message
        if diagnostic:
            full_msg = f"{message} ({diagnostic})"
        elif cause:
            sanitized_cause = sanitize_db_url(str(cause))
            full_msg = f"{message}: {sanitized_cause}"
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DURABLE_STORAGE_UNAVAILABLE", "message": full_msg},
        )


def ensure_durable_storage(db: Optional[AsyncSession], component: str = "operation") -> None:
    """Blocks in-memory fallback when durable storage is required in integration mode."""
    if db is None and settings.is_durable_mode:
        valid, diag = validate_database_config(settings)
        detail = diag if not valid else f"Database engine is not initialized for {component}."
        raise DurableStorageUnavailableError(
            message=f"Durable storage is required in integration mode: {detail}"
        )


EXPECTED_SCHEMA_TABLES = [
    "shops",
    "payment_accounts",
    "idempotency_records",
    "orders",
    "buyer_revisions",
    "link_measurements",
    "received_transactions",
    "transaction_observations",
    "allocations",
    "used_payment_markers",
    "audit_events",
    "order_review_reasons",
    "sms_evidence",
    "sms_imports",
    "payment_metrics",
    "evidence_cleanups",
    "payment_marker_keys",
    "courier_drafts",
    "pathao_connection_revisions",
    "courier_attempts",
    "courier_reconciliations",
    "pathao_catalog_snapshots",
    "pathao_catalog_lists",
    "pathao_catalog_sync",
]


@dataclass(frozen=True)
class DatabaseReadinessStatus:
    is_ready: bool
    diagnostic: str = ""
    missing_tables: tuple[str, ...] = ()


async def check_schema_inventory(session: AsyncSession) -> tuple[bool, list[str]]:
    """Queries current schema to verify all expected migration tables exist."""
    stmt = text("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()")
    result = await session.execute(stmt)
    existing = {str(row[0]) for row in result.fetchall()}
    missing = [t for t in EXPECTED_SCHEMA_TABLES if t not in existing]
    return (len(missing) == 0, missing)


async def check_database_readiness(
    cfg: Optional[Settings] = None,
    session_factory: Optional[async_sessionmaker[AsyncSession]] = None,
) -> DatabaseReadinessStatus:
    """Verifies that durable database storage is fully configured, reachable, and migrated."""
    active_cfg = cfg or settings
    valid, diag = validate_database_config(active_cfg)
    if not valid:
        return DatabaseReadinessStatus(is_ready=False, diagnostic=diag)

    factory = session_factory if session_factory is not None else AsyncSessionLocal
    if factory is None:
        return DatabaseReadinessStatus(
            is_ready=False,
            diagnostic="Database engine is not initialized. Check database connection string.",
        )

    try:
        async with factory() as session:
            await session.execute(text("SELECT 1"))
            all_present, missing = await check_schema_inventory(session)
            if not all_present:
                return DatabaseReadinessStatus(
                    is_ready=False,
                    diagnostic=f"Database schema incomplete: missing tables {missing}",
                    missing_tables=tuple(missing),
                )
            return DatabaseReadinessStatus(is_ready=True)
    except Exception as e:
        sanitized = sanitize_db_url(str(e))
        return DatabaseReadinessStatus(
            is_ready=False,
            diagnostic=f"Database connection failed: {sanitized}",
        )


class Base(DeclarativeBase):
    pass


engine = None
AsyncSessionLocal = None

db_url = settings.effective_database_url

if db_url and settings.is_database_configured:
    try:
        engine = create_database_engine(db_url, debug=settings.DEBUG)
        AsyncSessionLocal = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
        )
        logger.info("Configured Async Database Engine for Neon Postgres.")
    except Exception as e:
        logger.error(f"Failed to create database engine: {sanitize_db_url(str(e))}")
elif db_url:
    logger.info(
        "DATABASE_URL contains placeholder values. Neon database features will operate in standby mode until credentials are provided."
    )
else:
    logger.warning("DATABASE_URL is not set. Database features will operate in standby mode.")


async def get_db() -> AsyncGenerator[AsyncSession | None, None]:
    if AsyncSessionLocal is None:
        if settings.is_durable_mode:
            valid, diag = validate_database_config(settings)
            msg = f"Durable storage is required in integration mode: {diag if not valid else 'Database engine is not initialized.'}"
            raise DurableStorageUnavailableError(message=msg)
        yield None
        return
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except (SQLAlchemyError, asyncpg.PostgresError, OSError) as e:
            await session.rollback()
            sanitized = sanitize_db_url(str(e))
            if "does not exist" in sanitized.lower() or "undefined table" in sanitized.lower():
                raise DurableStorageUnavailableError(
                    message=f"Durable storage schema error: database tables are missing or not migrated. ({sanitized})"
                ) from e
            raise DurableStorageUnavailableError(
                message=f"Durable storage outage: database operation failed. Retry with the same mutation key. ({sanitized})",
                cause=e,
            ) from e
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
