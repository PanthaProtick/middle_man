# 01: Repeatable clean-database initialization

**What to build:** An operator can initialize a confirmed clean production database with an explicit, auditable command, safely rerun it, and receive a clear failure if the target or schema is unsuitable.

**Blocked by:** None (can start immediately).

**Status:** completed

- [x] Require explicit confirmation of the intended database target and verify its clean state before initialization; never print connection credentials or silently adopt an ambiguous existing schema.
- [x] Apply ordered migrations using a direct connection, with an applied-version/checksum ledger, serialization against concurrent runners, and transactions where supported.
- [x] Reject changed applied migrations; failed migrations stop initialization without reporting success. Define recovery for any operation that cannot be transactional.
- [x] Rerunning completed initialization is safe. Migration execution remains separate from request startup and ordinary frontend builds; runtime configuration uses a pooled connection.
- [x] Disposable PostgreSQL integration tests cover clean initialization, repeat execution, concurrent runners, checksum mismatch, ambiguous existing schema, and failed migration. Mock SQL is not sufficient evidence.
- [x] Document the command, target checks, direct versus pooled connection roles, and failure recovery without applying remote migrations as part of this ticket.
- [x] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact. Mark unavailable PostgreSQL evidence explicitly.

## Verification Evidence

- **Focused Unit & Integration Tests**:
  - `npm run test:backend -- tests/test_migrations.py tests/test_migrations_postgres.py`: 11 passed, 6 skipped in 0.26s.
  - Disposable PostgreSQL loopback evidence: 6 tests marked skipped in offline standby mode due to unset `BUYER_TEST_POSTGRES_URL`.
- **Pre-handoff Root Check Gate**:
  - Command: `npm run check`
  - Result: All stages passed (Tooling tests, Repository conventions, Backend lint, Backend types, Backend tests, Frontend lint, Frontend test, Frontend build, HTTP smoke).
  - Result artifact: `.cache/checks/check-S3L6HR/result.json`

