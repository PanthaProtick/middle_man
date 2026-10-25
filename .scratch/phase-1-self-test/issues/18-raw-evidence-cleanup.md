# 18: Run raw-evidence cleanup with safe retries

**What to build:** Run repeatable local cleanup that deletes due raw evidence and makes failed deletion visible and safely retryable.

**Blocked by:** 14: Recover from screenshot storage failures.

**Status:** completed

## Acceptance criteria

- [x] A documented local invocation processes the original 30-day deadlines for applicable raw images/SMS/AI records; edits/reimports do not reset deadlines.
- [x] Storage failure leaves the item pending/overdue instead of falsely deleted; retry completes only after removal succeeds and preserves structured state.
- [x] Controlled-time evidence covers boundary timing, an I/O outage and recovery; external backup/provider copies remain explicitly unproven.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing raw cleanup/status services, durable file adapter, controlled clock and seller retention view.

## Verification target

Use actual local files with injected controlled time/failure, existing raw-retention API/status tests and a feature overdue/retry presentation test.

Coverage: AC17, AC40, AC43. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Hosted scheduling/alerts, cloud purge certification and completed personal-record deletion.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Implementation details & decisions

1. **Documented local CLI runner and API invocations**:
   - Implemented `backend/app/services/raw_evidence_cli.py` (<100 lines) with CLI options `--shop-id`, `--as-of`, and `--allow-standby`.
   - Fails closed with structured `status="failed"` `RetentionCleanupResponse` if durable database is not configured (preventing false claims of clean deletion), unless `--allow-standby` is explicitly provided.
   - Outputs typed Pydantic v2 `RetentionCleanupResponse` as JSON and exits with code 0 on clean, 1 on failure/partial failure.
   - Documented operator CLI invocation and authenticated seller endpoint `POST /api/seller/retention/cleanup` in `docs/API_CONTRACTS.md` and `docs/retention-lifecycle.md`.

2. **Real filesystem storage & boundary timing (controlled clock)**:
   - Updated `backend/tests/test_raw_evidence_cleanup.py` and `backend/tests/test_evidence_postgres.py` to initialize real disk storage using `init_evidence_storage(tmp_path)`.
   - Verified controlled-time boundary conditions: at 29 days 23 hours, physical files remain untouched on disk; at 30 days + 1 second, physical files are unlinked.
   - Proved deadline immutability: seller order corrections and SMS re-imports preserve immutable 30-day collection deadlines (`delete_after`), never restarting the deadline.
   - Replay after deletion retains the tombstone digest (`uq_sms_evidence_digest`), preventing duplicate funds or allocations (AC17, AC40).

3. **Storage outage fault injection and safe retry**:
   - Injected storage outages (`inject_storage_outage(True)` / I/O errors):
     - Physical files are NOT unlinked and remain on disk.
     - Database and in-memory evidence records are NOT marked deleted (`status` remains attached/staged, `deleted_at` remains None).
     - `get_retention_status` reports the item as overdue and records failure items.
   - Outage recovery & retry (`inject_storage_outage(False)`):
     - Safe repeat cleanup unlinks the physical file from disk and commits status to `"deleted"` with `deleted_at = now`.
     - Seller evidence retrieval returns 410 `EVIDENCE_UNAVAILABLE`.
     - Structured state (order lifecycle, buyer revisions, payment claims, COD) remains completely intact (AC43).
   - Verified across both in-memory store and real PostgreSQL 18 with real filesystem storage.

4. **Frontend overdue & retry presentation**:
   - Expanded `frontend/src/features/seller/EvidenceRetentionPanel.test.tsx` with unit and integration tests covering:
     - Storage outage / network error handling with error alert display.
     - Retaining active button state after failure for safe retry.
     - Partial failure feedback display and overdue item listing with storage failure counts.
     - Successful user retry restoring clean retention status.

5. **External launch gates explicitly unproven**:
   - Synthetic tests do not prove deletion from cloud object storage version histories (e.g. S3/GCS delete markers), database WAL/PITR backups, or model provider logs (Gemini).
   - Documented these as explicit deployment/launch gates in `docs/retention-lifecycle.md` and `docs/API_CONTRACTS.md`.

## Verification results

- **Focused backend tests (standby & CLI)**:
  - `npm run test:backend -- tests/test_raw_evidence_cli.py tests/test_raw_evidence_cleanup.py tests/test_raw_evidence_status.py`: 9 passed in 0.17s.
- **PostgreSQL durable storage & evidence cleanup**:
  - `$env:BUYER_TEST_POSTGRES_URL="postgresql://postgres@127.0.0.1:55447/postgres"; npm run test:backend -- tests/test_evidence_postgres.py`: 6 passed in 1.57s.
- **Full backend test suite (PostgreSQL)**:
  - 489 passed in 44.46s.
- **Focused frontend tests**:
  - `npm run test:frontend -- src/features/seller/EvidenceRetentionPanel.test.tsx`: 5 passed in 98ms.
- **Full frontend test suite**:
  - 31 test files, 148 passed in 4.86s.
- **Typecheck & lint**:
  - `npm run typecheck`: 0 issues across 95 Python files; TypeScript noEmit clean.
  - `npm run lint`: 0 ruff errors; 0 oxlint errors across 99 files.
- **Final root verification gate**:
  - Command: `npm run check` (Run ID: `check-4g9Pu6`)
  - Result: Exit code 0 (All gates passed)
    - PASS Tooling tests (0.5s)
    - PASS Backend lint (0.0s)
    - PASS Backend types (0.4s)
    - PASS Backend tests (6.4s)
    - PASS Frontend lint (0.2s)
    - PASS Frontend test (5.3s)
    - PASS Frontend build (1.0s)
    - PASS HTTP smoke (1.8s)

## Comments

- 2026-10-25: Implemented CLI local runner with typed Pydantic contracts and fail-closed standby protection, verified boundary timing and real filesystem storage cleanup on disk with outage injection/recovery in standby and PostgreSQL modes, added frontend overdue/retry presentation tests, ran two-axis code review, and passed final root gate `npm run check`.
