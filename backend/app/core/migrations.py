import hashlib
import logging
import time
from pathlib import Path
from typing import Optional, Sequence
from urllib.parse import urlparse

import asyncpg

from app.core.database import sanitize_db_url
from app.core.migration_types import (
    AmbiguousSchemaError,
    ChecksumMismatchError,
    DirtyTargetError,
    MigrationError,
    MigrationExecutionError,
    MigrationFile,
    MigrationRecord,
    MigrationResult,
    SchemaState,
    TargetConfirmationError,
)

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
        migrations.append(
            MigrationFile(
                version=file.stem,
                filename=file.name,
                path=file,
                checksum=checksum,
                sql=sql,
            )
        )
    return migrations


async def inspect_schema_state(conn: asyncpg.Connection) -> tuple[SchemaState, list[str]]:
    """Inspects tables in current schema to determine migration readiness."""
    rows = await conn.fetch(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
    )
    tables = [str(row["table_name"]) for row in rows]
    if not tables:
        return SchemaState.CLEAN, tables
    if "schema_migrations" in tables:
        return SchemaState.TRACKED, tables
    return SchemaState.AMBIGUOUS, tables


async def ensure_ledger_table(conn: asyncpg.Connection) -> None:
    """Creates schema_migrations ledger if not already present."""
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
            execution_time_ms INTEGER NOT NULL
        )
        """
    )


async def fetch_applied_records(conn: asyncpg.Connection) -> list[MigrationRecord]:
    """Retrieves applied migration records in application order."""
    rows = await conn.fetch(
        "SELECT version, checksum, applied_at::text, execution_time_ms "
        "FROM schema_migrations ORDER BY applied_at ASC, version ASC"
    )
    return [
        MigrationRecord(
            version=str(row["version"]),
            checksum=str(row["checksum"]),
            applied_at=str(row["applied_at"]),
            execution_time_ms=int(row["execution_time_ms"]),
        )
        for row in rows
    ]


def verify_ledger_integrity(
    applied: Sequence[MigrationRecord], disk: Sequence[MigrationFile]
) -> list[MigrationFile]:
    """Verifies applied migrations match disk checksums, returning pending migrations."""
    disk_by_version = {m.version: m for m in disk}
    applied_versions: set[str] = set()

    for record in applied:
        disk_m = disk_by_version.get(record.version)
        if disk_m is None:
            raise ChecksumMismatchError(
                f"Applied migration '{record.version}' is missing from disk migrations directory"
            )
        if disk_m.checksum != record.checksum:
            raise ChecksumMismatchError(
                f"Checksum mismatch for '{record.version}': recorded {record.checksum}, disk {disk_m.checksum}"
            )
        applied_versions.add(record.version)

    pending = [m for m in disk if m.version not in applied_versions]
    return pending


async def apply_pending_migrations(
    conn: asyncpg.Connection,
    pending: Sequence[MigrationFile],
    target_database: str,
) -> MigrationResult:
    """Executes pending migrations sequentially inside transactions."""
    applied_versions: list[str] = []
    total_time_ms = 0

    for migration in pending:
        start = time.perf_counter()
        try:
            async with conn.transaction():
                await conn.execute(migration.sql)
                elapsed_ms = max(1, int((time.perf_counter() - start) * 1000))
                await conn.execute(
                    "INSERT INTO schema_migrations (version, checksum, execution_time_ms) VALUES ($1, $2, $3)",
                    migration.version,
                    migration.checksum,
                    elapsed_ms,
                )
        except Exception as exc:
            sanitized_err = sanitize_db_url(str(exc))
            raise MigrationExecutionError(
                f"Failed to apply migration '{migration.version}': {sanitized_err}"
            ) from exc

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
    connection: Optional[asyncpg.Connection] = None,
    search_path: Optional[str] = None,
    ssl: Optional[object] = None,
) -> MigrationResult:
    """Main migration runner with target validation, locking, and ledger tracking."""
    target_db = validate_target_confirmation(url, confirmed_target)
    m_dir = migrations_dir or (Path(__file__).parents[2] / "migrations")
    disk_migrations = load_disk_migrations(m_dir)

    conn = connection
    owns_conn = False
    if conn is None:
        clean_url = normalize_asyncpg_url(url)
        parsed = urlparse(clean_url)
        use_ssl = ssl
        if use_ssl is None and (
            parsed.hostname in ("127.0.0.1", "localhost", "::1")
            or "sslmode=disable" in clean_url
        ):
            use_ssl = False

        server_settings = {"search_path": search_path} if search_path else None
        conn = await asyncpg.connect(
            clean_url,
            ssl=use_ssl,
            server_settings=server_settings,
        )
        owns_conn = True
    elif search_path:
        await conn.execute(f'SET search_path TO "{search_path}"')

    try:
        await conn.execute("SELECT pg_advisory_lock($1)", MIGRATION_ADVISORY_LOCK_ID)
        try:
            state, tables = await inspect_schema_state(conn)
            if state == SchemaState.AMBIGUOUS:
                raise AmbiguousSchemaError(
                    f"Target schema contains {len(tables)} tables without a schema_migrations ledger; silent adoption is rejected"
                )
            if require_clean and state != SchemaState.CLEAN:
                raise DirtyTargetError(
                    f"Target database '{target_db}' is not clean; contains existing schema ({state.value})"
                )

            await ensure_ledger_table(conn)
            applied = await fetch_applied_records(conn)
            pending = verify_ledger_integrity(applied, disk_migrations)
            return await apply_pending_migrations(conn, pending, target_db)
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", MIGRATION_ADVISORY_LOCK_ID)
    finally:
        if owns_conn:
            await conn.close()
