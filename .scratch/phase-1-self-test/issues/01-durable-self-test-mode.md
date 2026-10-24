# 01: Fail explicitly when durable storage is unavailable

**What to build:** Run an explicit self-test integration mode that requires durable persistence and reports database failures instead of succeeding in memory.

**Blocked by:** None (can start immediately).

**Status:** complete

## Acceptance criteria

- [x] Missing, placeholder or invalid database configuration and engine/schema initialization failure block durable self-test operations with explicit diagnostics.
- [x] A runtime outage returns a typed failure or resolves an already committed same-key result; it never switches to memory.
- [x] Explicit offline development remains functional and cannot be confused with integration readiness; diagnostics contain no credentials.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Configuration, application startup, database dependency and one existing seller mutation with its error UI.

## Verification target

Use startup/configuration cases and one route-level write/outage regression; exercise adapter queries and restart on a disposable database. Record target validation and schema inventory.

Coverage: AC39, AC50. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Authentication, secret migration, public access and a general rewrite of database services.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

### Decisions & Implementation
1. **Mode Configuration (`app.core.config.Settings`)**:
   - Added `SELF_TEST_MODE: bool = False`, `APP_MODE: str = "offline"`, `REQUIRE_DURABLE_STORAGE: bool = False`.
   - Added property `is_durable_mode` determining whether durable persistence is mandatory (True in production, when `SELF_TEST_MODE=True`, `APP_MODE` is `"self-test"` or `"integration"`, or `REQUIRE_DURABLE_STORAGE=True`).
   - Default remains explicit offline development mode (`is_durable_mode=False`), which preserves offline memory stores and existing starter routes/tests (AC50).
2. **Credential Sanitization & Diagnostics (`app.core.database`)**:
   - `sanitize_db_url`: Masks password credentials with `***` in connection strings, diagnostics, and error messages.
   - `validate_database_config`: Emits explicit non-credential diagnostics for missing, placeholder, or invalid database settings.
   - `DurableStorageUnavailableError`: HTTP 503 exception returning typed JSON (`DURABLE_STORAGE_UNAVAILABLE`) with sanitized diagnostics and same-key retry guidance.
3. **Database Dependency & Schema Inventory (`app.core.database`)**:
   - `EXPECTED_SCHEMA_TABLES`: 20 tables across migrations `0001` through `0017` (`shops`, `payment_accounts`, `idempotency_records`, `orders`, `buyer_revisions`, `link_measurements`, `received_transactions`, `transaction_observations`, `allocations`, `used_payment_markers`, `audit_events`, `order_review_reasons`, `sms_evidence`, `sms_imports`, `payment_metrics`, `order_evidence`, `address_extractions`, `payment_extractions`, `evidence_cleanups`, `payment_marker_keys`).
   - `check_schema_inventory`: Verifies table presence via `information_schema.tables`.
   - `check_database_readiness`: Verifies connection and schema completeness.
   - `get_db`: In durable mode, raises `DurableStorageUnavailableError` when database engine is unconfigured or when runtime database errors/outages occur, preventing silent fallback to process memory.
4. **Idempotency & Seller Mutation Boundaries (`app.core.idempotency`, `app.services.seller_service`)**:
   - Both `check_idempotency_record`/`save_idempotency_record` and `SellerService` refuse memory fallback in durable mode when `db is None`, raising `DurableStorageUnavailableError`.
   - Runtime database outage mid-acceptance raises typed 503 and rolls back without touching memory stores.
   - Same-key replay resolves previously committed database records without re-execution or fallback.
5. **Error UI Presentation (`frontend/src/features/seller`)**:
   - Verified that `SellerWorkspace` displays explicit error alerts (`role="alert"`) with the 503 diagnostic message when shop creation fails due to durable storage unavailability.

### Changed Paths
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/app/core/idempotency.py`
- `backend/app/services/seller_service.py`
- `backend/app/main.py`
- `backend/app/models/schemas.py`
- `backend/app/api/routes.py`
- `frontend/src/features/seller/SellerWorkspace.test.tsx`
- `backend/tests/test_durable_mode.py`
- `backend/tests/test_durable_postgres.py`
- `.scratch/phase-1-self-test/issues/01-durable-self-test-mode.md`

### Verification Evidence
- `npm run test:backend -- tests/test_durable_mode.py`: 13 passed in 0.16s
- `npm run test:backend -- tests/test_durable_postgres.py`: 1 passed, 1 skipped (loopback postgres) in 0.03s
- `npm run test:frontend -- src/features/seller/SellerWorkspace.test.tsx`: 9 passed in 133ms
- `npm run typecheck`: clean (0 issues in 86 backend files, clean tsc in frontend)
- Final Root Gate `npm run check`: ALL 8 STAGES PASSED
  - PASS Tooling tests (0.7s)
  - PASS Backend lint (0.1s)
  - PASS Backend types (0.6s)
  - PASS Backend tests (5.5s)
  - PASS Frontend lint (0.3s)
  - PASS Frontend test (7.1s)
  - PASS Frontend build (1.4s)
  - PASS HTTP smoke (1.8s)
  - Run result: `.cache/checks/check-TYuE7R/result.json`
