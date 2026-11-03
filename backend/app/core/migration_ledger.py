from typing import Sequence

import asyncpg

from app.core.migration_types import (
    ChecksumMismatchError,
    MigrationFile,
    MigrationRecord,
    SchemaState,
)


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

    return [m for m in disk if m.version not in applied_versions]
