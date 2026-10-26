# 05: Review a booking-ready draft

**What to build:** A seller can complete unresolved delivery details and review the current recipient, pickup store, service, parcel, and remaining COD in one draft. Corrections require review of current data, and cancelled or incomplete orders cannot be submitted.

**Blocked by:** 02 — Capture parcel details early; 04 — Collect Pathao delivery locations from buyers.

**Status:** implemented — local verification complete

## Implementation record (2026-10-26)

- Added seller review resource and integrated parcel/review workspace, using one
  existing draft. Migration 0023 stores choices and a review fingerprint only.
- Review revalidates catalog parent relationships, coverage, store membership,
  service, connection/environment and explicit parcel facts; COD remains derived
  from the accepted allocation. All external submission stays disabled.
- Fingerprints bind order/buyer/draft/settings revisions. Provider reads occur
  outside locks; approval rechecks under shop/order/draft locks. Corrections
  discard previous destination overrides and stale responses are session scoped.
- Agreed seams: HTTP API, disposable PostgreSQL, seller components. Focused
  backend review/draft regressions: 35 passed, including 15 PostgreSQL cases.
  Seller review + parcel component tests: 9 passed. Strict types passed.
- Standalone offline tests require SELF_TEST_MODE=false for this checkout.
  Disposable loopback PostgreSQL is on port 55434; no environment file was read.
- Contract: docs/pathao-review-contract.md. Browser, live Pathao/Clerk, sandbox
  booking, hosted migration and physical-device acceptance: NOT RUN.
- Review baseline: `fad1e0ac5c0caf39e764b3d911d243e792228f58`.

## Standards review

- Initial P2: seller catalog endpoint lacked direct success/failure coverage.
  Added hierarchy, invalid parents, stale settings, shop isolation and retention
  API tests, plus dependent seller selector/reset component coverage.
- Independent follow-up: **0 remaining Standards findings**.

## Spec review

- Initial P2: saving delivery choices advanced the draft version without updating
  the parcel editor. The workspace now shares the returned parcel revision,
  preserving unsaved inputs. It advances only if stored parcel facts match, so
  concurrent parcel changes still conflict. Added workspace regression.
- Initial P2: invalid hierarchy IDs appeared as provider unavailability. Added
  a correction-specific blocker and regression assertion.
- Independent follow-up: **0 remaining Spec findings**.

## Final verification

- First full gate `.cache/checks/check-PhBY6a/result.json` failed on import
  ordering in the new PostgreSQL test file. Corrected; no runtime change.
- Second gate `.cache/checks/check-D0oBuh/result.json`: 539 backend tests passed,
  one migration-inventory failure and 32 Windows temp-directory setup errors.
  Updated inventory for migration 0023; reran with repository-local TEMP/TMP and
  pytest basetemp. No application test assertions were removed or weakened.
- Final root `npm run check` (2026-10-27): **PASS**,
  `.cache/checks/check-Kn9yww/result.json`: tooling, backend/frontend lint, strict
  types, **572 backend tests**, **180 frontend tests**, production build and HTTP
  smoke. Disposable PostgreSQL enabled on loopback 55434, all migrations applied
  only in disposable per-test schemas. Hosted migration: NOT RUN.
- Browser/live Clerk, live catalogs, sandbox/production booking, physical devices:
  NOT RUN. No external submission capability was enabled. Ticket 06 is next for
  the protected offline attempt workflow; no part of ticket 06 was implemented.

- [x] Deliver a complete seller review view that combines the current buyer submission, parcel fields, connected account/environment, selected store/service, and server-derived remaining COD.
- [x] Allow the seller to resolve missing location selections and parcel information, review or override eligible saved pickup/service defaults, and see all remaining readiness blockers.
- [x] Revalidate location relationships, supported service, store membership, account/environment, and explicit parcel values on the backend. Missing connection or metadata blocks booking, not order collection or committed confirmation.
- [x] COD uses the accepted advance, including seller payment exceptions and fully prepaid zero collection. The review never replaces this value with the expected advance or allows an arbitrary client override.
- [x] Bind review to the order, buyer, draft, and selected connection/settings revisions needed to detect stale information. Corrections committed before submission refresh the draft and invalidate stale review where relevant.
- [x] A cancelled, retained/erased, unconfirmed, or no-longer-eligible order cannot become submit-ready. Repeated review operations do not create a booking or another draft.
- [x] Preserve existing payment locks: delivery correction cannot rewrite accepted payment terms or allocation. Keep shop ownership, version conflicts, session isolation, and late-response handling consistent with existing seller operations.
- [x] The interface clearly distinguishes completed review from an actual Pathao booking. Do not enable a real external submission before the protected attempt workflow exists.
- [x] Verify API/PostgreSQL and seller component behavior for metadata completion, default overrides, actual COD, disconnected/unsupported blockers, stale review, correction, cancellation, cross-shop access, and session changes.
- [x] Run focused tests and root `npm run check` as the final gate; record actual results and any unrun browser/provider checks.
