# 07: Organize courier workflows

**Status:** implemented — reviewed and locally verified

**What to build:** Cohesive courier draft, review, submission, reconciliation, and settings workflows whose organization preserves seller control and duplicate-booking protections.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [x] Use inventory-bounded targets and trace UI, endpoints, services, adapters, fixtures, and tests for each courier responsibility before modifying it.
- [x] Organize existing modules and colocated tests by owned behavior, decomposing oversized responsibilities without changing external interfaces or schema.
- [x] Preserve one local draft per confirmation, seller review, parcel/location validation, server-derived remaining COD balance, and independent order-confirmation success.
- [x] Preserve stale-draft/account revision protection, replay behavior, uncertain-outcome blockers, reconciliation, privacy, and retention guarantees.
- [x] Preserve localization, entered/provider data, focus/input recovery, and protection against repeated courier actions.
- [x] Preserve meaningful adapter, API, rendered, replay, failure, and PostgreSQL coverage; verify discovery and fixtures after moves and document narrow size exceptions.
- [x] Verify each bounded responsibility before proceeding; no live bookings or provider mutations are authorized as cleanup verification.
- [x] Run final root `npm run check` and record dispositions, exceptions, actual integration results, and unrun hosted/device/live-provider gates.

## Work record

### Execution (2026-10-29)

Base: `5718937355200c8364e1b0f440fa0de6ffd712f0`, clean `main`.
Dependencies: 02 records implementation; 03 has all acceptance boxes checked
and a passing final check in its execution record despite its stale status label.
Scope is organization only; no runtime interfaces, schema, or business rules change.

Trace/disposition:

- `OrderDetailModal` mounts `CourierWorkspace`, composing `CourierDraft` and
  `CourierReview`; review owns choices/approval/submission and delegates location
  selection and outcomes/reconciliation. `AccountsSection` mounts `PathaoSettings`.
  Keep these existing feature-colocated UI, types, API helper and locale modules:
  their state identities, generation checks, saved parcel feedback, focus recovery,
  and busy guards already have rendered tests. Moving them would add import churn
  without improving ownership. No frontend source or tests changed.
- `api/courier.py` owns seller-scoped draft/review/submission/reconciliation routes;
  `api/pathao.py` owns merchant connection/defaults/store routes. Keep the typed
  models and route interfaces. Draft preparation is called from `allocation.py`;
  review fingerprints current order/buyer/draft/account facts; reservation locks
  and rechecks before attempts perform provider I/O outside transactions.
  Reconciliation separates evidence validation, replay and locked resolution;
  retention erases private courier details. Provider, booking transport, catalog,
  connections and secrets already have distinct responsibilities. Keep all these
  bounded production modules (largest courier service: review, 234 lines).
- Split `test_courier_post_submission_changes.py` (495 -> 265 lines) into completed
  booking/review invalidation/isolation/replay, `test_courier_in_flight_changes.py`
  (92), and `test_courier_unknown_outcome_changes.py` (138).
- Split `test_courier_submission_postgres.py` (402 -> 234) from post/in-flight
  correction/cancellation in `test_courier_changes_postgres.py` (165). Keep
  concurrency, reservation races, persistence failure and restart protection
  together in the original suite. Shared offline fixtures live in
  `courier_submission_support.py` (24), explicitly imported by consuming suites.
- Split `test_courier_submission_failures.py` (301 -> 173) from snapshot,
  malformed-success and privacy checks in `test_courier_submission_validation.py`
  (121). Existing PostgreSQL case imports still resolve to the original suite.
- Split `test_pathao_sandbox_booking.py` (367 -> 156) from mocked wire-contract
  classification/lookup/no-replay checks in `test_pathao_booking_transport.py`
  (124). `pathao_sandbox_support.py` (114) owns synthetic credentials, mocked
  transport/router, review setup and sandbox isolation. Each test module imports
  autouse isolation and seller/store fixtures explicitly. No provider call is live.
- No assertions, scenarios, decorators, or parametrization removed. An untracked
  ignored `.cache/verify-courier-moves.py` compared ASTs of all 47 original
  functions/fixtures/helpers against their destinations; all identical. Scripts
  used for this cleanup remain ignored execution artifacts, outside `.scratch/`.

Size review: no touched source/test exceeds 300 lines and no size exception is
needed. Retain `test_courier_drafts.py` (278): HTTP draft creation/edit/authority
contract and shared confirmation setup; `test_courier_reconciliation_postgres.py`
(255): five transactional resolution/audit/concurrency/restart cases;
`CourierReview.test.tsx` (255): rendered review/submit success, stale/session
recovery, dependent locations, unknown/definitive outcomes and duplicate clicks.
Splitting these solely at the 250-line review trigger would fragment cohesive
boundaries. `CourierDraft.tsx` (241), post-submission rendered tests (235) and
Pathao settings (156) remain bounded. Locale ownership stays with ticket 08.

Verification so far:

- Baseline and post-move `npm run test:backend -- -k 'courier or pathao'`:
  668 total collected, 175 selected; **113 passed, 62 skipped, 493 deselected**
  both times. Selected set includes one related obsolete-cleanup PostgreSQL case.
- First cluster focused run: all 9 completed/in-flight/unknown-change tests pass.
- Second cluster focused run: **33 passed, 14 skipped** across six split suites.
  Initial attempt found missing sandbox fixture/helper imports; repaired explicit
  imports and reran successfully before proceeding.
- `npm run test:frontend -- Courier Pathao`: **14 files, 61 tests passed**.
- `npm run typecheck`: backend Mypy (115 source files) and frontend TypeScript pass.
- PostgreSQL cases collect but skip without the optional test database; actual
  transactional integration is **NOT RUN**. Browser, physical device, screen reader,
  hosted/real Clerk, Pathao sandbox/live requests and provider mutations are
  **NOT RUN**. Mocked sandbox transport is not sandbox acceptance.


**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Backend: `courier_review.py` 234, `courier_reconciliation.py`,
  `courier_attempts.py`, `courier_drafts.py`, `courier_reservation.py`,
  `pathao_*` services, `api/courier.py`, `api/pathao.py`, courier models.
- Frontend: `CourierDraft.tsx` 241, `CourierReview.tsx`, `CourierWorkspace`,
  reconciliation/outcome components, `PathaoSettings.tsx`, courier locale copy
  (coordinate with 08), and their rendered tests.
- Tests: `test_courier_post_submission_changes.py` 495 and
  `test_courier_submission_postgres.py` 402 need split/exception;
  `test_pathao_sandbox_booking.py` 367, `test_courier_submission_failures.py` 301,
  `test_courier_drafts.py` 278, `test_courier_reconciliation_postgres.py` 255;
  `CourierReview.test.tsx` 255 and `CourierPostSubmissionChanges.test.tsx` 235.
- Preserve one local draft per confirmation, seller review, parcel/location
  validation, server-derived COD, stale-revision protection, replay, uncertain
  outcomes, reconciliation, privacy, and duplicate-booking prevention.
- No live booking, provider mutation, or sandbox request is cleanup verification.

**Required checks:** focused courier tests per responsibility, component/API
collection checks, then `npm run check`. Report sandbox/live gates as NOT RUN
unless separately authorized and executed.

### Final review and verification

- Code-review skill ran independent Standards and Spec reviewers against the
  starting base and staged changes: **0 findings on each axis**, no scope creep.
- First root check `.cache/checks/check-awi9Tw/result.json` stopped at backend
  tests: 492 passed, 175 skipped, 1 setup error from Windows denying access to
  the global pytest temp directory in `test_smoke_environment.py`. Later stages
  did not run in that attempt.
- Final root check with
  `$env:PYTEST_ADDOPTS = '--basetemp=E:/middle_man/.cache/pytest-courier-final'`:
  **PASS**, `.cache/checks/check-ESFNzj/result.json`. All eight stages pass:
  tooling tests, backend lint/types/tests (**493 passed, 175 skipped**), frontend
  lint/tests (**81 files, 439 passed**), production build and HTTP smoke.
  This environment override supplies disposable local storage; it does not filter tests.
- No actual PostgreSQL integration, browser/device/screen-reader, hosted/Clerk,
  or live/sandbox provider acceptance ran. No bookings or external mutations.
- Next: ticket 08 may use these courier boundaries for shared/auth organization;
  ticket 09 retains documentation/prevention ownership. No courier implementation
  follow-up is required within this cleanup scope.
