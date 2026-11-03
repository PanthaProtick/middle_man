"""Database schema inventory, column requirements, and migration compatibility validation."""

import logging
import re
from typing import Optional, Set

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.migration_ledger import verify_ledger_integrity
from app.core.migration_types import MigrationError, MigrationRecord
from app.core.migrations import DEFAULT_MIGRATIONS_DIR, load_disk_migrations

logger = logging.getLogger(__name__)

EXPECTED_SCHEMA_TABLES: list[str] = [
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


def _sanitize_db_error(msg: str) -> str:
    """Masks potential database connection strings or credentials in error messages."""
    return re.sub(r"://([^:@/]+):([^@/]+)@", r"://\1:***@", msg)


async def check_schema_compatibility(
    session: AsyncSession,
    existing_tables: Optional[Set[str]] = None,
) -> tuple[bool, str]:
    """Verifies schema table presence, column presence, and migration ledger alignment."""
    # 1. Table inventory check (reuse existing tables if supplied, avoiding duplicate queries)
    if existing_tables is None:
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
        sanitized = _sanitize_db_error(str(exc))
        return False, f"Migration ledger query failed: {sanitized}"

    return True, ""
