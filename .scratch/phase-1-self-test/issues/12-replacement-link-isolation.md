# 12: Keep replacement links isolated

**What to build:** Keep an old order's buyer link limited to its own terminal status after seller replacement.

**Blocked by:** 08: Submit once and recover an uncertain response.

**Status:** completed

## Acceptance criteria

- [x] Eligible replacement creates a distinct order/link; the predecessor cannot submit, upload, redirect to or disclose the successor token.
- [x] An unrevoked retained predecessor shows only its own terminal status; revoked/deleted access remains denied when those facilities are present.
- [x] Allocated/confirmed predecessors retain existing replacement restrictions and payment single-use guarantees.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing order replacement action, public predecessor projection and upload/submission eligibility checks.

## Verification target

Existing replacement API/PostgreSQL tests plus a focused public projection/browser-component case; assert response payload and redirect behavior.

Coverage: AC30, AC34–AC36, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Adding a new replacement workflow, moving allocated funds and implementing revocation itself.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24.

### 2026-10-25 implementation and verification

- Verified and enforced link isolation when replacing orders:
  - Successor orders receive a distinct order ID and portal token.
  - Predecessor orders transition to `cancelled` (or retain `expired` if previously expired).
  - Predecessor public projection (`GET /api/public/orders/{token}`) returns 200 with predecessor's own terminal status without issuing HTTP 3xx redirects or `Location` headers.
  - Predecessor public projection excludes successor token, successor order ID, predecessor ID, and replacement reason (AC36, AC48).
  - Predecessor links cannot submit details (`POST /submission` returns 409 `ORDER_ALREADY_SUBMITTED` or 410 `EXPIRED_SUBMISSION`) or upload evidence (`POST /evidence` returns 409 or 410).
  - If predecessor link is explicitly revoked (`/revoke-link`), public access and mutations return 410 `BUYER_LINK_REVOKED`. If soft-deleted / purged from retention, access returns 410 `RECORD_UNAVAILABLE`.
  - Allocated/confirmed predecessor orders retain replacement restrictions (POST `/replacement` returns 409 `PAYMENT_RESOLUTION_REQUIRED`) and payment single-use guarantees (attempting to allocate the same receipt to another order fails with 409 `PAYMENT_USED`, AC30).
- Changed paths:
  - `backend/tests/test_replacement_link_isolation.py`
  - `backend/tests/test_replacement_lifecycle_isolation.py`
  - `backend/tests/test_order_outcomes_postgres.py`
  - `frontend/src/features/buyer/BuyerReplacementIsolation.test.tsx`
  - `.scratch/phase-1-self-test/issues/12-replacement-link-isolation.md`
- Parallel two-axis code review findings addressed:
  - Standards Reviewer: Extracted shared `_buyer_submission` helper to remove data clump/duplication; renamed internal order fixture to `purged_order`; replaced vacuous string assertions with HTML and hyperlink absence assertions.
  - Spec Reviewer: Added assertion for payment single-use guarantees (409 `PAYMENT_USED`); added PostgreSQL evidence upload blocking on cancelled predecessor; removed out-of-scope AI extraction assertions; updated ticket record with verification results.
- Focused verification:
  - `npm run test:backend -- tests/test_replacement_link_isolation.py tests/test_replacement_lifecycle_isolation.py`: PASS (5 passed)
  - `npm run test:frontend -- src/features/buyer/BuyerReplacementIsolation.test.tsx`: PASS (3 passed)
  - `npm run typecheck`: PASS (no issues found in 92 backend files and frontend TypeScript)
  - `npm run lint`: PASS (0 warnings, 0 errors across backend and frontend)
- Final root verification gate:
  - `npm run check`: PASS (`.cache/checks/check-xBWPrw/result.json`). All 8 stages passed: Tooling tests (0.5s), Backend lint (0.0s), Backend types (0.4s), Backend tests (6.0s), Frontend lint (0.2s), Frontend test (5.2s), Frontend build (1.0s), HTTP smoke (1.8s).
- Remaining gaps:
  - Multi-user browser session and live external SMS/gemini flow journeys are covered by subsequent acceptance tickets.
