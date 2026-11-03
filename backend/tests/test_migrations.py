from pathlib import Path

import pytest

from app.core.migration_types import (
    ChecksumMismatchError,
    MigrationError,
    MigrationFile,
    MigrationRecord,
    TargetConfirmationError,
)
from app.core.migrations import (
    compute_checksum,
    extract_database_name,
    load_disk_migrations,
    normalize_asyncpg_url,
    validate_target_confirmation,
    verify_ledger_integrity,
)
from app.core.migrations_cli import build_parser, resolve_migration_url


def test_compute_checksum_normalizes_crlf_and_lf():
    lf_content = "CREATE TABLE test (\n    id SERIAL PRIMARY KEY\n);\n"
    crlf_content = "CREATE TABLE test (\r\n    id SERIAL PRIMARY KEY\r\n);\r\n"
    assert compute_checksum(lf_content) == compute_checksum(crlf_content)
    assert len(compute_checksum(lf_content)) == 64


def test_extract_database_name():
    assert (
        extract_database_name("postgresql://user:pass@host:5432/production_db")
        == "production_db"
    )
    assert (
        extract_database_name(
            "postgresql+asyncpg://user:pass@ep-test.neon.tech/neondb?sslmode=require"
        )
        == "neondb"
    )
    with pytest.raises(TargetConfirmationError):
        extract_database_name("postgresql://user:pass@host:5432/")


def test_validate_target_confirmation():
    url = "postgresql://user:pass@localhost:5432/target_db"
    assert validate_target_confirmation(url, "target_db") == "target_db"

    with pytest.raises(TargetConfirmationError, match="mismatch"):
        validate_target_confirmation(url, "wrong_db")


def test_normalize_asyncpg_url():
    assert (
        normalize_asyncpg_url("postgresql+asyncpg://user:pass@host/db")
        == "postgresql://user:pass@host/db"
    )
    assert (
        normalize_asyncpg_url("postgresql+psycopg://user:pass@host/db")
        == "postgresql://user:pass@host/db"
    )
    assert (
        normalize_asyncpg_url("postgresql://user:pass@host/db")
        == "postgresql://user:pass@host/db"
    )


def test_load_disk_migrations_finds_all_29_ordered():
    migrations_dir = Path(__file__).parents[1] / "migrations"
    migrations = load_disk_migrations(migrations_dir)
    assert len(migrations) == 29
    assert migrations[0].version == "0001_initial_seller_tables"
    assert migrations[-1].version == "0029_public_admission"

    # Strict sorting
    versions = [m.version for m in migrations]
    assert versions == sorted(versions)


def test_load_disk_migrations_missing_directory(tmp_path: Path):
    missing_dir = tmp_path / "does_not_exist"
    with pytest.raises(MigrationError, match="does not exist"):
        load_disk_migrations(missing_dir)


def test_verify_ledger_integrity_detects_tampered_migration():
    disk = [
        MigrationFile(
            version="0001_test",
            filename="0001_test.sql",
            path=Path("dummy"),
            checksum="disk_hash_abc",
            sql="SELECT 1;",
        ),
        MigrationFile(
            version="0002_test",
            filename="0002_test.sql",
            path=Path("dummy"),
            checksum="disk_hash_def",
            sql="SELECT 2;",
        ),
    ]
    # Applied ledger contains a different checksum
    applied = [
        MigrationRecord(
            version="0001_test",
            checksum="tampered_hash_xyz",
            applied_at="2026-01-01T00:00:00Z",
            execution_time_ms=10,
        )
    ]
    with pytest.raises(ChecksumMismatchError, match="Checksum mismatch"):
        verify_ledger_integrity(applied, disk)


def test_verify_ledger_integrity_returns_pending_migrations():
    disk = [
        MigrationFile(
            version="0001_test",
            filename="0001_test.sql",
            path=Path("dummy"),
            checksum="hash_1",
            sql="SELECT 1;",
        ),
        MigrationFile(
            version="0002_test",
            filename="0002_test.sql",
            path=Path("dummy"),
            checksum="hash_2",
            sql="SELECT 2;",
        ),
    ]
    applied = [
        MigrationRecord(
            version="0001_test",
            checksum="hash_1",
            applied_at="2026-01-01T00:00:00Z",
            execution_time_ms=10,
        )
    ]
    pending = verify_ledger_integrity(applied, disk)
    assert len(pending) == 1
    assert pending[0].version == "0002_test"


def test_resolve_migration_url_prioritizes_cli():
    url = resolve_migration_url("postgresql://cli_override/db")
    assert url == "postgresql://cli_override/db"


def test_build_parser_requires_confirm_target():
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args([])


def test_load_disk_migrations_detects_no_transaction_directive(tmp_path: Path):
    (tmp_path / "0001_standard.sql").write_text("CREATE TABLE t1 (id INT);", encoding="utf-8")
    (tmp_path / "0002_concurrent.sql").write_text(
        "-- NO-TRANSACTION\nCREATE INDEX CONCURRENTLY idx ON t1 (id);",
        encoding="utf-8",
    )
    migrations = load_disk_migrations(tmp_path)
    assert len(migrations) == 2
    assert migrations[0].transactional is True
    assert migrations[1].transactional is False

