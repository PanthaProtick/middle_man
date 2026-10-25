# 13: Persist and privately retrieve screenshots

**What to build:** Upload a generated screenshot, restart the application and let only the owning seller retrieve the preserved image.

**Blocked by:** 08: Submit once and recover an uncertain response; 09: Bound public request admission.

**Status:** completed

## Acceptance criteria

- [x] A persistent repository-local evidence folder is ignored before files are created; no upload is tracked or mounted as public static content.
- [x] Valid images persist with their database ownership metadata across restart; opaque storage keys cannot escape the intended root.
- [x] Only owning-seller reads succeed; buyer/foreign evidence IDs and ineligible order uploads are rejected. Preserve image byte/pixel/count validation and bounded ingress.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing evidence storage interface, startup wiring, upload validation, seller viewer and local ignore configuration.

## Verification target

API upload/private-read tests, real filesystem restart evidence, Git ignore/tracked-file checks and existing upload/viewer feature tests.

Coverage: AC02, AC11, AC39, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Drive/cloud storage, full I/O fault cleanup and retention orchestration.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24.

### 2026-10-25 implementation and verification

- Repository-local evidence directory configuration and Git exclusion:
  - Added `.evidence/` to `.gitignore`. Verified via `git check-ignore` that `.evidence/` is ignored before any runtime writes occur.
  - Confirmed via `git ls-files .evidence` that 0 evidence files are tracked in source control.
  - Verified no route mounts or exposes `.evidence/` as static or public content; public order projections exclude raw evidence and internal keys (AC48).
- Durable persistence and startup wiring:
  - Configured `EVIDENCE_STORAGE_DIR: str = ".evidence"` and `effective_evidence_storage_path` in `backend/app/core/config.py`, anchoring relative paths to repository root.
  - Wired `init_evidence_storage()` into application startup `lifespan` in `backend/app/main.py`.
- Path traversal protection and outage normalization:
  - Added `StoragePathEscapeError` and strict key validation in `_resolve_storage_path` within `backend/app/services/evidence_store.py`:
    - Rejects empty, null-byte, root-anchored, absolute, drive-letter, and relative traversal keys (`..`, `.`, `./`, `.\`).
    - Normalized filesystem `OSError` (e.g. disk quota/permissions) into `StorageOutageError` (HTTP 503 `STORAGE_UNAVAILABLE`).
- Process restart persistence rehearsal:
  - End-to-end verified upload of generated screenshots to local disk, attachment via submission, simulating process restart (clearing memory file store), and private retrieval by verified owning seller (`GET /api/seller/evidence/{id}`) returning exact image content and `Cache-Control: private, no-store`.
  - Foreign shop access returns 404 `NOT_FOUND` without leaking existence (AC02). Unauthenticated access returns 401. Foreign evidence IDs on order submission return 422 `FOREIGN_EVIDENCE_REFERENCE` (AC11).
  - Ineligible order states (expired, submitted, revoked) and excessive images (>5) reject uploads (AC11).
- Changed paths:
  - `.gitignore`
  - `backend/app/core/config.py`
  - `backend/app/main.py`
  - `backend/app/services/evidence_store.py`
  - `backend/tests/test_durable_evidence.py`
  - `backend/tests/test_evidence_storage.py`
  - `.scratch/phase-1-self-test/issues/13-durable-private-screenshots.md`
- Parallel two-axis code review findings addressed:
  - Standards Reviewer: Removed duplicated test scenario from `backend/tests/test_evidence_postgres.py` keeping it at 231 lines (under 250); added robust environment guard before `git` subprocess check.
  - Spec Reviewer: Added `OSError` normalization to `StorageOutageError` on file operations; tightened traversal validation for current-directory `.` and `./` in both memory and disk modes; updated ticket record with verification results.
- Focused verification:
  - `npm run test:backend -- tests/test_durable_evidence.py tests/test_evidence_storage.py tests/test_evidence_routes.py tests/test_evidence_postgres.py`: PASS (29 passed, 6 skipped loopback)
  - `npm run test:frontend -- src/features/buyer/EvidenceUploadField.test.tsx src/features/seller/EvidenceViewer.test.tsx`: PASS (7 passed)
  - `npm run typecheck`: PASS (no issues found in 92 backend source files, frontend tsc 0 errors)
- Final pre-handoff verification gate:
  - Root `npm run check`: PASS (Tooling tests, Backend lint, Backend types, Backend tests [363 passed, 87 skipped], Frontend lint, Frontend test [144 passed], Frontend build, HTTP smoke). Result: `.cache/checks/check-DpH6Df/result.json`.
