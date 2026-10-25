# 14: Recover from screenshot storage failures

**What to build:** Give clear recoverable outcomes when local evidence writes, reads or associated database commits fail.

**Blocked by:** 13: Persist and privately retrieve screenshots.

**Status:** completed

## Acceptance criteria

- [x] Filesystem read/write/delete exceptions map to typed application outcomes without fabricated success or private path disclosure.
- [x] Partial writes and rollback after file creation are safely cleaned or recorded for repeatable orphan recovery; no attachment points to an uncommitted success.
- [x] Retry behavior preserves original mutation semantics and does not duplicate attachments or delete another order's file.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Filesystem adapter exception mapping, evidence mutation transaction boundary and upload/viewer failure UI.

## Verification target

Inject adapter I/O faults and database failure after file creation; assert durable metadata/file outcomes and user retry states, not internal helper calls.

Coverage: AC11, AC37–AC39, storage portion of AC43. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Retention scheduling and unrelated transaction refactors.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Implementation details & decisions

1. **Path disclosure & exception mapping**:
   - Normalized `StorageOutageError` messages to sanitized descriptions (`"Storage write failed"`, `"Storage read failed"`, `"Storage delete failed"`), preventing leakage of host filesystem roots/paths.
   - Sanitized all `SellerDomainException(503, "STORAGE_UNAVAILABLE", ...)` HTTP details to generic, privacy-safe text (`"Private storage service is unavailable"`).
2. **Atomic write & partial write cleanup**:
   - In `backend/app/services/evidence_store.py`, `save_evidence_file` writes to a per-write temporary file in the target directory (`.{name}.{uuid}.tmp`), followed by atomic replace (`replace(target_path)`). On write/replace failure, temporary files are cleanly unlinked without deleting pre-existing target paths.
3. **Database rollback & orphan recovery**:
   - Wrapped database commits and post-file-creation operations in `try...except`. On failure, the transaction rolls back, immediate file deletion is attempted, and any remaining orphan key is recorded via `record_orphan_evidence(storage_key)` in an in-memory set and on-disk manifest (`.orphans.txt`).
   - `recover_orphan_evidence()` scans orphan keys, deletes existing orphan files, updates manifests, and reports true recovery counts.
4. **Prevent attachment of uncommitted evidence**:
   - In `attach_order_evidence` (both PostgreSQL and in-memory modes), checked that `ev.status in ("staged", "attached")`. Any attempt to attach failed or uncommitted evidence is rejected with `422 UNCOMMITTED_EVIDENCE`.
5. **Frontend user recovery states**:
   - `EvidenceUploadField.tsx`: Retains the failed file reference upon upload failure and provides an inline "Retry" button so buyers can retry after a transient outage without reopening the system file picker.
   - `EvidenceViewer.tsx`: Displays an inline "Retry" button on error states so sellers can re-query the screenshot evidence once transient storage outages clear.
6. **Code decomposition**:
   - Decomposed `evidence_service.py` (<90 lines) into `evidence_staging.py` (staging & validation logic, 268 lines) and `evidence_retrieval.py` (seller retrieval & expiration logic, 73 lines), keeping all source files below the repository limit (250–300 lines).

## Verification results

- **Focused backend tests**:
  - `npm run test:backend -- tests/test_evidence_storage.py tests/test_evidence_routes.py tests/test_durable_evidence.py tests/test_evidence_recovery.py`: 43 passed.
  - `npm run test:backend -- tests/test_evidence_postgres.py`: 6 skipped in offline standby mode; executed and passed in root check with dockerized postgres.
- **Focused frontend tests**:
  - `npm run test:frontend -- src/features/buyer/EvidenceUploadField.test.tsx src/features/seller/EvidenceViewer.test.tsx`: 9 passed.
  - Full frontend suite: `npm run test:frontend`: 31 files, 146 passed.
- **Typechecking & lint**:
  - `npm run typecheck`: Success (94 Python source files, TypeScript noEmit clean).
  - `npm run lint`: Clean (0 ruff warnings, 0 oxlint warnings/errors across 99 files).
- **Final root verification gate**:
  - Command: `npm run check` (Run ID: `check-bvSvkL`)
  - Result: Exit code 0 (All gates passed)
    - PASS Tooling tests (0.5s)
    - PASS Backend lint (0.0s)
    - PASS Backend types (0.5s)
    - PASS Backend tests (6.3s)
    - PASS Frontend lint (0.2s)
    - PASS Frontend test (5.2s)
    - PASS Frontend build (1.0s)
    - PASS HTTP smoke (1.8s)

## Comments

- 2026-10-25: Implemented storage fault recovery, orphan tracking, atomic writes, uncommitted attachment rejection, and frontend user retry states across backend and frontend. Verified with full `npm run check` pass.
