# 02: Require available Pathao destination choices

**What to build:** Buyers select valid Pathao city, zone, and area choices when
available and write their street/house/landmark address themselves. Catalog failures
or unsupported coverage preserve the submission for explicit seller resolution.

**Blocked by:** None (can start immediately).

**Status:** complete — local verification passed (2026-10-30).

**Implementation difficulty:** 4/5 — High.

**Why:** Mandatory selections must coexist with empty catalogs, outages, changing
connections, parent/child validation, and submission replay. A blanket required
validator would block valid fallback submissions or break already accepted retries.

**Agent fit:** Strong asynchronous form and API validation experience; comfortable
with provider-authority and idempotency boundaries.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [x] Require supported city/zone/area selections wherever those catalog choices
  exist. Show useful Bengali/English guidance and focus invalid fields; keep manual
  street/house/landmark entry available and required as appropriate.
- [x] Reset dependent choices on parent changes and reject known invalid hierarchy
  membership server-side, regardless of client-supplied labels or resolved flags.
- [x] Distinguish loading from established unavailability. Do not silently treat
  an in-flight catalog request as permission to bypass required available choices.
- [x] Preserve written address and payment claim through disconnected/unavailable
  catalogs, unsupported coverage, empty city/zone lists, and no-area zones, with
  explicit seller-resolution state and no fabricated IDs or support claims.
- [x] A selected unsupported area or explicit coverage problem cannot authorize
  courier submission. Keep existing courier readiness and booking safeguards.
- [x] Server-derived location authority remains authoritative; frontend checks
  improve usability without trusting client assertions about provider conditions.
- [x] Preserve submission idempotency: accepted replays do not need fresh catalog
  work or lose prior results when provider availability changes.
- [x] HTTP tests cover complete/missing choices, forged IDs, empty lists, outage,
  unsupported/no-area cases, changing connection/catalog authority, and replay.
- [x] Rendered tests cover required feedback, parent resets, loading/unavailable
  transitions, bilingual copy, and preservation of written/payment drafts.
- [x] Run focused location/submission tests and final root `npm run check`; use
  existing offline catalogs/intercepted transports, never live Pathao or Gemini.

## Notes

This can land before or after address AI retirement. Coordinate shared buyer-form
edits without inventing a semantic dependency. It does not establish live booking
readiness or remove any existing booking-disable policy.

## Implementation and review — 2026-10-30

- Available choices are enforced by the server, with field-specific required and
  invalid errors. Empty catalogs/outages retain written-address/payment fallback;
  IDs and labels remain server-derived. Parent changes reset dependent choices.
- Fixed two safety gaps during verification: saved explicit unsupported flags now
  survive courier review until the seller resolves them, and validation errors are
  deferred until the connection revision is rechecked. Changed authority discards
  stale errors and unverifiable IDs. Accepted replay bypasses fresh catalog work.
- Rendered feedback distinguishes loading from established unavailability and
  translates required/invalid errors in both languages while preserving drafts.
- Changed backend paths: `backend/app/api/public_orders.py`,
  `backend/app/services/pathao_catalog.py`, `pathao_locations.py`,
  `seller_service.py`; `backend/tests/test_pathao_location_requirements.py`,
  `test_pathao_location_review.py`, `test_pathao_locations.py`,
  `test_courier_review.py`.
- Changed frontend paths under `frontend/src/features/buyer/`:
  `BuyerSubmissionForm.tsx`, `PathaoLocations.tsx`, `pathaoTypes.ts`,
  `submissionErrors.ts`, `validateBuyerDraft.ts`,
  `BuyerLocationRequirements.test.tsx`, `BuyerRetry.test.tsx`; locale copy in
  `frontend/src/features/locale/buyerLocations.ts`.
- Updated contracts: `docs/pathao-location-contract.md` and
  `docs/contracts/buyer-access-and-corrections.md`.
- Focused backend command: `npm run test:backend --
  tests/test_pathao_location_requirements.py tests/test_pathao_location_review.py
  tests/test_pathao_locations.py tests/test_courier_review.py`: **43 passed**.
- Focused frontend command: `npm run test:frontend --
  src/features/buyer/BuyerLocationRequirements.test.tsx
  src/features/buyer/PathaoLocations.test.tsx
  src/features/buyer/PathaoLocaleStates.test.tsx
  src/features/buyer/BuyerRetry.test.tsx`: **22 passed**.
- Final root `npm run check`: **PASS**, including lint, strict types, build and
  HTTP smoke; backend **507 passed / 174 skipped**, frontend **441 passed**.
  Result: `.cache/checks/check-8cAb2x/result.json`. Set
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-pathao-ticket02-final`
  to avoid the host's inaccessible default pytest temporary directory. Earlier
  gates exposed a corrected typing error and the host temp-permission failure.
- Size review: the 273-line HTTP requirements suite remains below the hard limit;
  downstream courier coverage is kept in a separate cohesive regression file.
- Limits: opt-in PostgreSQL tests skipped; browser/device and live-provider
  acceptance **NOT RUN**. Automated tests used offline catalogs/intercepted
  transports, with no live Pathao or Gemini calls. No unresolved code findings.
- Next action: commit this verified ticket slice; other review-assistant tickets
  remain separate work.
