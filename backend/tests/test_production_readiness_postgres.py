import os
import shutil
import uuid
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import check_database_readiness
from app.core.migrations import (
    DEFAULT_MIGRATIONS_DIR,
    extract_database_name,
    normalize_asyncpg_url,
    run_migrations,
)
from app.core.readiness import check_schema_compatibility


@pytest.fixture
async def pg_schema():
    """Provides an isolated disposable PostgreSQL test schema on loopback."""
    url = os.environ.get("BUYER_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Set BUYER_TEST_POSTGRES_URL to a disposable loopback PostgreSQL target")
    hostname = urlparse(url).hostname
    assert hostname in ("127.0.0.1", "localhost", "::1"), f"Only loopback permitted: {hostname}"

    schema = f"readiness_test_{uuid.uuid4().hex}"
    conn = await asyncpg.connect(url, ssl=False)
    await conn.execute(f'CREATE SCHEMA "{schema}"')
    try:
        yield url, schema
    finally:
        await conn.execute(f'DROP SCHEMA "{schema}" CASCADE')
        await conn.close()


@pytest.fixture
async def session_factory_builder():
    engines = []

    def _build(url: str, schema: str):
        clean_url = normalize_asyncpg_url(url)
        prefix = "postgresql://"
        engine_url = (
            "postgresql+asyncpg://" + clean_url[len(prefix) :]
            if clean_url.startswith(prefix)
            else clean_url
        )
        engine = create_async_engine(
            engine_url,
            connect_args={"server_settings": {"search_path": schema}, "ssl": False},
            isolation_level="AUTOCOMMIT",
        )
        engines.append(engine)
        return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    yield _build

    for eng in engines:
        await eng.dispose()


async def test_empty_database_fails_schema_compatibility(pg_schema, session_factory_builder) -> None:
    url, schema = pg_schema
    factory = session_factory_builder(url, schema)

    async with factory() as session:
        ok, diag = await check_schema_compatibility(session)
        assert ok is False
        assert "missing tables" in diag.lower()


async def test_fully_migrated_database_passes(pg_schema, session_factory_builder) -> None:
    url, schema = pg_schema
    db_name = extract_database_name(url)
    await run_migrations(url=url, confirmed_target=db_name, require_clean=True, search_path=schema)

    factory = session_factory_builder(url, schema)
    async with factory() as session:
        ok, diag = await check_schema_compatibility(session)
        assert ok is True
        assert diag == ""

    # check_database_readiness also passes with fully migrated session
    from app.core.config import Settings
    status = await check_database_readiness(
        cfg=Settings(DATABASE_URL=url), session_factory=factory
    )
    assert status.is_ready is True


async def test_missing_column_rejected(pg_schema, session_factory_builder) -> None:
    url, schema = pg_schema
    db_name = extract_database_name(url)
    await run_migrations(url=url, confirmed_target=db_name, require_clean=True, search_path=schema)

    factory = session_factory_builder(url, schema)
    async with factory() as session:
        await session.execute(text("ALTER TABLE orders DROP COLUMN buyer_link_revoked_at"))
        ok, diag = await check_schema_compatibility(session)
        assert ok is False
        assert "missing required columns" in diag.lower()
        assert "orders.buyer_link_revoked_at" in diag


async def test_missing_ledger_table_rejected(pg_schema, session_factory_builder) -> None:
    url, schema = pg_schema
    db_name = extract_database_name(url)
    await run_migrations(url=url, confirmed_target=db_name, require_clean=True, search_path=schema)

    factory = session_factory_builder(url, schema)
    async with factory() as session:
        await session.execute(text("DROP TABLE schema_migrations"))
        ok, diag = await check_schema_compatibility(session)
        assert ok is False
        assert "missing migration ledger" in diag.lower()


async def test_checksum_mismatch_rejected(pg_schema, session_factory_builder) -> None:
    url, schema = pg_schema
    db_name = extract_database_name(url)
    await run_migrations(url=url, confirmed_target=db_name, require_clean=True, search_path=schema)

    factory = session_factory_builder(url, schema)
    async with factory() as session:
        await session.execute(
            text(
                "UPDATE schema_migrations SET checksum = 'tampered' "
                "WHERE version = '0001_initial_seller_tables'"
            )
        )
        ok, diag = await check_schema_compatibility(session)
        assert ok is False
        assert "Checksum mismatch" in diag


async def test_pending_migrations_rejected(
    pg_schema, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, session_factory_builder
) -> None:
    url, schema = pg_schema
    db_name = extract_database_name(url)
    await run_migrations(url=url, confirmed_target=db_name, require_clean=True, search_path=schema)

    for f in DEFAULT_MIGRATIONS_DIR.glob("*.sql"):
        shutil.copy(f, tmp_path / f.name)
    (tmp_path / "0099_unapplied_new_feature.sql").write_text("SELECT 1;", encoding="utf-8")

    monkeypatch.setattr("app.core.schema.DEFAULT_MIGRATIONS_DIR", tmp_path)

    factory = session_factory_builder(url, schema)
    async with factory() as session:
        ok, diag = await check_schema_compatibility(session)
        assert ok is False
        assert "behind migrations" in diag.lower()
        assert "0099_unapplied_new_feature" in diag
