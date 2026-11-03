import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
import pytest

from app.core.migration_types import (
    AmbiguousSchemaError,
    ChecksumMismatchError,
    DirtyTargetError,
    MigrationExecutionError,
)
from app.core.migrations import extract_database_name, run_migrations


@asynccontextmanager
async def open_test_conn(url: str, schema: str):
    """Context manager for test queries against an isolated schema."""
    conn = await asyncpg.connect(url, ssl=False, server_settings={"search_path": schema})
    try:
        yield conn
    finally:
        await conn.close()


@pytest.fixture
async def pg_schema():
    """Provides an isolated disposable PostgreSQL test schema on loopback."""
    url = os.environ.get("BUYER_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Set BUYER_TEST_POSTGRES_URL to a disposable loopback PostgreSQL target")
    hostname = urlparse(url).hostname
    assert hostname in ("127.0.0.1", "localhost", "::1"), f"Only loopback permitted: {hostname}"

    schema = f"mig_test_{uuid.uuid4().hex}"
    conn = await asyncpg.connect(url, ssl=False)
    await conn.execute(f'CREATE SCHEMA "{schema}"')
    try:
        yield url, schema
    finally:
        await conn.execute(f'DROP SCHEMA "{schema}" CASCADE')
        await conn.close()


async def test_clean_database_initialization(pg_schema):
    url, schema = pg_schema
    db_name = extract_database_name(url)

    result = await run_migrations(
        url=url,
        confirmed_target=db_name,
        require_clean=True,
        search_path=schema,
    )
    assert result.status == "applied"
    assert result.applied_count == 29
    assert len(result.applied_versions) == 29

    async with open_test_conn(url, schema) as conn:
        rows = await conn.fetch("SELECT version FROM schema_migrations ORDER BY version")
        assert len(rows) == 29
        assert rows[0]["version"] == "0001_initial_seller_tables"


async def test_repeat_execution_idempotency(pg_schema, tmp_path: Path):
    url, schema = pg_schema
    db_name = extract_database_name(url)

    first = await run_migrations(
        url=url,
        confirmed_target=db_name,
        require_clean=True,
        search_path=schema,
    )
    assert first.applied_count == 29

    # Safe rerun of the exact same clean initialization command
    second = await run_migrations(
        url=url,
        confirmed_target=db_name,
        require_clean=True,
        search_path=schema,
    )
    assert second.status == "up_to_date"
    assert second.applied_count == 0
    assert len(second.applied_versions) == 0

    # Rerun with standard migrate runner also reports up-to-date
    third = await run_migrations(
        url=url,
        confirmed_target=db_name,
        require_clean=False,
        search_path=schema,
    )
    assert third.status == "up_to_date"

    # Require clean must reject a target that has pending unapplied migrations (incomplete schema)
    import shutil

    from app.core.migrations import DEFAULT_MIGRATIONS_DIR

    for f in DEFAULT_MIGRATIONS_DIR.glob("*.sql"):
        shutil.copy(f, tmp_path / f.name)
    (tmp_path / "0099_extra_pending.sql").write_text("SELECT 2;", encoding="utf-8")
    with pytest.raises(DirtyTargetError, match="pending migrations"):
        await run_migrations(
            url=url,
            confirmed_target=db_name,
            migrations_dir=tmp_path,
            require_clean=True,
            search_path=schema,
        )


async def test_concurrent_runners_advisory_locking(pg_schema):
    url, schema = pg_schema
    db_name = extract_database_name(url)

    async def execute_runner():
        return await run_migrations(
            url=url,
            confirmed_target=db_name,
            require_clean=False,
            search_path=schema,
        )

    res1, res2 = await asyncio.gather(execute_runner(), execute_runner())
    counts = sorted([res1.applied_count, res2.applied_count])
    assert counts == [0, 29]

    async with open_test_conn(url, schema) as conn:
        rows = await conn.fetch("SELECT count(*) as cnt FROM schema_migrations")
        assert rows[0]["cnt"] == 29


async def test_checksum_mismatch_rejected(pg_schema):
    url, schema = pg_schema
    db_name = extract_database_name(url)

    await run_migrations(
        url=url,
        confirmed_target=db_name,
        require_clean=True,
        search_path=schema,
    )

    async with open_test_conn(url, schema) as conn:
        await conn.execute(
            "UPDATE schema_migrations SET checksum = 'altered_checksum_hash' "
            "WHERE version = '0001_initial_seller_tables'"
        )

    with pytest.raises(ChecksumMismatchError, match="Checksum mismatch"):
        await run_migrations(
            url=url,
            confirmed_target=db_name,
            require_clean=False,
            search_path=schema,
        )


async def test_ambiguous_existing_schema_rejected(pg_schema):
    url, schema = pg_schema
    db_name = extract_database_name(url)

    async with open_test_conn(url, schema) as conn:
        await conn.execute("CREATE TABLE rogue_table (id INT PRIMARY KEY)")

    with pytest.raises(AmbiguousSchemaError, match="without a schema_migrations ledger"):
        await run_migrations(
            url=url,
            confirmed_target=db_name,
            require_clean=False,
            search_path=schema,
        )


async def test_failed_migration_rollback_and_non_transactional(pg_schema, tmp_path: Path):
    url, schema = pg_schema
    db_name = extract_database_name(url)

    (tmp_path / "0001_good.sql").write_text("CREATE TABLE good_tbl (id INT);", encoding="utf-8")
    (tmp_path / "0002_bad.sql").write_text("INVALID SYNTAX;", encoding="utf-8")
    (tmp_path / "0003_nontxn.sql").write_text(
        "-- no-transaction\nCREATE TABLE nontxn_tbl (id INT);",
        encoding="utf-8",
    )

    with pytest.raises(MigrationExecutionError, match="Failed to apply migration '0002_bad'"):
        await run_migrations(
            url=url,
            confirmed_target=db_name,
            migrations_dir=tmp_path,
            require_clean=True,
            search_path=schema,
        )

    async with open_test_conn(url, schema) as conn:
        rows = await conn.fetch("SELECT version FROM schema_migrations")
        assert [r["version"] for r in rows] == ["0001_good"]
