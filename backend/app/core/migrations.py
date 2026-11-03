import hashlib
import logging
import time
from pathlib import Path
from typing import Optional, Sequence
from urllib.parse import urlparse

import asyncpg

from app.core.database import sanitize_db_url
from app.core.migration_ledger import (
    ensure_ledger_table,
    fetch_applied_records,
    inspect_schema_state,
    verify_ledger_integrity,
)
from app.core.migration_types import (
    AmbiguousSchemaError,
    DirtyTargetError,
    MigrationError,
    MigrationExecutionError,
    MigrationFile,
    MigrationResult,
    SchemaState,
    TargetConfirmationError,
)

__all__ = [
    "MIGRATION_ADVISORY_LOCK_ID",
    "compute_checksum",
    "extract_database_name",
    "validate_target_confirmation",
    "normalize_asyncpg_url",
    "load_disk_migrations",
    "inspect_schema_state",
    "ensure_ledger_table",
    "fetch_applied_records",
    "verify_ledger_integrity",
    "apply_pending_migrations",
    "run_migrations",
]

logger = logging.getLogger(__name__)

MIGRATION_ADVISORY_LOCK_ID = 5570020120194849345  # 0x4D4944444C454D41 ('MIDDLEMA')


def compute_checksum(content: str) -> str:
    """Computes SHA-256 digest normalized for line endings."""
    normalized = content.replace("\r\n", "\n").encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()


def extract_database_name(url: str) -> str:
    """Extracts target database name from connection URL."""
    parsed = urlparse(url)
    db_name = parsed.path.lstrip("/")
    if not db_name:
        raise TargetConfirmationError("Unable to extract target database name from URL")
    return db_name


def validate_target_confirmation(url: str, confirmed_target: str) -> str:
    """Validates that confirmed target matches database in URL."""
    actual = extract_database_name(url)
    if actual != confirmed_target:
        raise TargetConfirmationError(
            f"Target confirmation mismatch: expected '{confirmed_target}', but connection target is '{actual}'"
        )
    return actual


def normalize_asyncpg_url(url: str) -> str:
    """Ensures connection URL is compatible with asyncpg."""
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg://"):
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix) :]
    return url


def load_disk_migrations(migrations_dir: Path) -> list[MigrationFile]:
    """Loads and orders all SQL migration files from disk."""
    if not migrations_dir.exists():
        raise MigrationError(f"Migrations directory does not exist: {migrations_dir}")
    files = sorted(migrations_dir.glob("*.sql"))
    if not files:
        raise MigrationError(f"No SQL migrations found in: {migrations_dir}")

    migrations: list[MigrationFile] = []
    for file in files:
        sql = file.read_text(encoding="utf-8")
        checksum = compute_checksum(sql)
        is_transactional = "-- no-transaction" not in sql.lower()
        migrations.append(
            MigrationFile(
                version=file.stem,
                filename=file.name,
                path=file,
                checksum=checksum,
                sql=sql,
                transactional=is_transactional,
            )
        )
    return migrations


async def _execute_single_migration(conn: asyncpg.Connection, migration: MigrationFile) -> int:
    """Executes a single migration script either transactionally or non-transactionally."""
    start = time.perf_counter()
    try:
        if migration.transactional:
            async with conn.transaction():
                await conn.execute(migration.sql)
                elapsed_ms = max(1, int((time.perf_counter() - start) * 1000))
                await conn.execute(
                    "INSERT INTO schema_migrations (version, checksum, execution_time_ms) VALUES ($1, $2, $3)",
                    migration.version,
                    migration.checksum,
                    elapsed_ms,
                )
        else:
            await conn.execute(migration.sql)
            elapsed_ms = max(1, int((time.perf_counter() - start) * 1000))
            await conn.execute(
                "INSERT INTO schema_migrations (version, checksum, execution_time_ms) VALUES ($1, $2, $3)",
                migration.version,
                migration.checksum,
                elapsed_ms,
            )
        return elapsed_ms
    except Exception as exc:
        sanitized_err = sanitize_db_url(str(exc))
        extra_note = (
            ""
            if migration.transactional
            else " (non-transactional migration: manual recovery may be required)"
        )
        raise MigrationExecutionError(
            f"Failed to apply migration '{migration.version}': {sanitized_err}{extra_note}"
        ) from exc


async def apply_pending_migrations(
    conn: asyncpg.Connection,
    pending: Sequence[MigrationFile],
    target_database: str,
) -> MigrationResult:
    """Executes pending migrations sequentially."""
    applied_versions: list[str] = []
    total_time_ms = 0

    for migration in pending:
        elapsed_ms = await _execute_single_migration(conn, migration)
        applied_versions.append(migration.version)
        total_time_ms += elapsed_ms

    status_str = "applied" if applied_versions else "up_to_date"
    return MigrationResult(
        status=status_str,
        target_database=target_database,
        applied_count=len(applied_versions),
        applied_versions=tuple(applied_versions),
        total_execution_time_ms=total_time_ms,
    )


async def run_migrations(
    url: str,
    confirmed_target: str,
    *,
    migrations_dir: Optional[Path] = None,
    require_clean: bool = False,
    search_path: Optional[str] = None,
) -> MigrationResult:
    """Main migration runner with target validation, locking, and ledger tracking."""
    target_db = validate_target_confirmation(url, confirmed_target)
    m_dir = migrations_dir or (Path(__file__).parents[2] / "migrations")
    disk_migrations = load_disk_migrations(m_dir)

    clean_url = normalize_asyncpg_url(url)
    parsed = urlparse(clean_url)
    use_ssl = (
        False
        if (
            parsed.hostname in ("127.0.0.1", "localhost", "::1")
            or "sslmode=disable" in clean_url
        )
        else None
    )
    server_settings = {"search_path": search_path} if search_path else None
    conn = await asyncpg.connect(clean_url, ssl=use_ssl, server_settings=server_settings)

    try:
        await conn.execute("SELECT pg_advisory_lock($1)", MIGRATION_ADVISORY_LOCK_ID)
        try:
            state, tables = await inspect_schema_state(conn)
            if state == SchemaState.AMBIGUOUS:
                raise AmbiguousSchemaError(
                    f"Target schema contains {len(tables)} tables without a schema_migrations ledger; silent adoption is rejected"
                )

            await ensure_ledger_table(conn)
            applied = await fetch_applied_records(conn)
            pending = verify_ledger_integrity(applied, disk_migrations)

            if require_clean and state != SchemaState.CLEAN:
                # If target is already tracked and fully up to date, rerun is safe
                if state == SchemaState.TRACKED and not pending:
                    return MigrationResult(
                        status="up_to_date",
                        target_database=target_db,
                        applied_count=0,
                        applied_versions=(),
                        total_execution_time_ms=0,
                    )
                raise DirtyTargetError(
                    f"Target database '{target_db}' is not clean; contains existing schema with {len(pending)} pending migrations"
                )

            return await apply_pending_migrations(conn, pending, target_db)
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", MIGRATION_ADVISORY_LOCK_ID)
    finally:
        await conn.close()
