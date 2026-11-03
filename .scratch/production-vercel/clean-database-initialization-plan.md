# Implementation Plan: Repeatable Clean-Database Initialization

**Issue:** `.scratch/production-vercel/issues/01-clean-database-initialization.md`
**Title:** 01: Repeatable clean-database initialization
**Goal:** An operator can initialize a confirmed clean production database with an explicit, auditable command, safely rerun it, and receive a clear failure if the target or schema is unsuitable.

---

## 1. Acceptance Criteria Inventory

- [x] **AC-1 (Target Confirmation & Cleanliness):** Require explicit confirmation of the intended database target (`--confirm-target <dbname>`); verify clean state before initialization (`--require-clean` or initial run); never print connection credentials; reject and never silently adopt an ambiguous existing schema (tables exist without `schema_migrations` ledger).
- [x] **AC-2 (Ordered Migrations, Ledger, Serialization, Transactions):** Apply ordered migrations (0001 to 0028) using a direct connection (`DIRECT_URL` / direct unpooled URL). Maintain `schema_migrations` ledger (`version`, `checksum`, `applied_at`, `execution_time_ms`). Serialize concurrent runners with PostgreSQL session advisory lock (`pg_advisory_lock`). Execute each migration within a database transaction.
- [x] **AC-3 (Checksum Integrity & Failure Handling):** Detect and reject altered applied migrations (`ChecksumMismatchError`). Stop immediately on migration failure without marking success or recording failed version in ledger. Define failure recovery for transactional rollback and any hypothetical non-transactional DDL.
- [x] **AC-4 (Safe Reruns & Operational Separation):** Safe rerun on an already-migrated database (reports up-to-date, applies 0, exits 0, preserves all data). Migration execution remains strictly separate from request startup and frontend builds. Direct connection for migrations vs pooled connection (`DATABASE_URL`) for runtime.
- [x] **AC-5 (Disposable PostgreSQL Tests):** Real PostgreSQL integration test suite covering:
  1. Clean database initialization (0 to 28 migrations).
  2. Repeat execution (safe idempotency).
  3. Concurrent runners (advisory lock serialization).
  4. Checksum mismatch rejection.
  5. Ambiguous existing schema rejection.
  6. Failed migration rollback and recovery.
- [x] **AC-6 (Documentation):** Document the command, target checks, direct vs pooled connection roles, and failure recovery without applying remote migrations.
- [x] **AC-7 (Verification Gates):** Focused tests (`npm run test:backend`), typechecks, lint, conventions, and root `npm run check`.

---

## 2. Architectural Design & Boundaries

### 2.1 Direct Connection vs Pooled Connection
- **Direct Connection (`DIRECT_URL`):** Required for DDL migrations and initialization. Connects directly to PostgreSQL / Neon compute without PgBouncer transaction pooling. PgBouncer in transaction mode does not support session-level advisory locks (`pg_advisory_lock`), prepared statements, or session-level lock timeouts.
- **Pooled Connection (`DATABASE_URL`):** Used strictly by application runtime (`app/core/database.py`) for low-overhead serverless request handling.
- **URL Sanitization:** Credentials (`password`) must never be logged or printed. All outputs mask passwords using regex/URL formatting: `postgresql://user:***@host:port/database`.

### 2.2 Target Confirmation & Safety Checks
- Target URL source: `--url` parameter, falling back to `DIRECT_URL`, then `DATABASE_URL`.
- Target confirmation: Operator MUST pass `--confirm-target <target_database_name>`. The database name in the URL is compared against `--confirm-target`. Any mismatch halts execution immediately.
- Cleanliness verification:
  - If schema has no tables: Confirmed clean target.
  - If schema has `schema_migrations`: Existing tracked target. Validates all applied migration checksums against repository files.
  - If schema has tables but NO `schema_migrations`: Ambiguous schema! Aborts with `AmbiguousSchemaError`. Silent adoption is prohibited.
  - If `--require-clean` is passed on an already-populated schema: Aborts with `DirtyTargetError`.

### 2.3 Advisory Locking & Serialization
- Advisory Lock ID: Fixed 64-bit integer derived from namespace: `5570020120194849345` (ASCII `MIDDLEMA`).
- On acquire, the runner holds the session advisory lock until all pending migrations commit or fail, released in a `finally` block.
- Double-checked locking: Once the lock is acquired, the runner re-queries `schema_migrations` to verify if a concurrent runner just finished applying the pending migrations.

### 2.4 Transactional Execution & Ledger
- Table definition:
  ```sql
  CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      execution_time_ms INTEGER NOT NULL
  );
  ```
- Each migration file is read as UTF-8, its SHA-256 checksum computed.
- Wrapped in `async with connection.transaction():`
  1. `await connection.execute(sql)`
  2. `INSERT INTO schema_migrations (version, checksum, execution_time_ms) VALUES (...)`
- On error: transaction rolls back automatically; the failed migration is not recorded; error is logged with sanitized details.

---

## 3. Implementation Details & File Layout

### 3.1 Files to Create / Modify
1. `backend/app/core/migrations.py` (< 250 lines):
   - Data structures: `MigrationFile`, `MigrationRecord`, `MigrationStatus`.
   - Helper functions: `compute_checksum(content)`, `get_disk_migrations(dir)`, `parse_database_target(url)`.
   - Core async logic:
     - `acquire_advisory_lock(conn)` / `release_advisory_lock(conn)`
     - `inspect_schema_state(conn)` -> clean / tracked / ambiguous
     - `verify_applied_checksums(conn, disk_migrations)`
     - `apply_migrations(conn, disk_migrations, require_clean=False)`
2. `backend/app/core/migrations_cli.py` (< 150 lines):
   - Argument parsing: `--url`, `--confirm-target`, `--require-clean`, `--migrations-dir`.
   - Runner execution: sanitizes outputs, validates target confirmation, formats human-readable and JSON status reports.
   - Exit codes: 0 for success/up-to-date, 1 for errors/mismatches/failures.
3. `package.json` & `scripts/workspace.mjs`:
   - Add `db:migrate`: `backend(['python', '-m', 'app.core.migrations_cli', ...args])`
   - Add `db:init`: `backend(['python', '-m', 'app.core.migrations_cli', '--require-clean', ...args])`
4. `docs/database-initialization.md` (< 200 lines):
   - Documents command usage (`npm run db:init`, `npm run db:migrate`).
   - Explains target confirmation safety check and why silent adoption is rejected.
   - Explains Direct vs Pooled connection roles.
   - Documents failure recovery (transactional rollback, resolving non-transactional edge cases).
5. Tests:
   - `backend/tests/test_migrations.py` (< 200 lines): Unit tests for CLI parsing, target confirmation matching, URL credential masking, checksum calculation, disk migration ordering.
   - `backend/tests/test_migrations_postgres.py` (< 250 lines): Disposable loopback PostgreSQL integration tests for:
     1. Clean initialization of all 28 migrations.
     2. Repeat execution (idempotent rerun).
     3. Concurrent runners (simultaneous execution with advisory locking).
     4. Checksum mismatch detection and rejection.
     5. Ambiguous existing schema rejection.
     6. Failed migration rollback and ledger integrity.

---

## 4. Verification Plan

1. **Focused Backend Unit Tests:**
   `npm run test:backend -- tests/test_migrations.py`
2. **Focused PostgreSQL Integration Tests:**
   `$env:BUYER_TEST_POSTGRES_URL="postgresql://postgres@127.0.0.1:5432/postgres"; npm run test:backend -- tests/test_migrations_postgres.py`
3. **Existing PostgreSQL Regression Tests:**
   `$env:BUYER_TEST_POSTGRES_URL="postgresql://postgres@127.0.0.1:5432/postgres"; npm run test:backend -- tests/test_durable_postgres.py tests/test_database_connection_options.py`
4. **Tooling & Conventions Check:**
   `npm run conventions`
   `npm run typecheck`
   `npm run lint`
5. **Full Root Pre-Handoff Gate:**
   `npm run check`
