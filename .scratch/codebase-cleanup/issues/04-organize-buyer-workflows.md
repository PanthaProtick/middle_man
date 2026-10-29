# 04: Organize buyer workflows

**Status:** implemented — reviewed and locally verified

**What to build:** Buyer submission, correction, and status workflows with cohesive code and discoverable tests, preserving their externally observable behavior and access limits.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [x] Use the inventory's bounded buyer targets; trace rendered flows, API callers, domain boundaries, and tests before editing.
- [x] Organize affected UI, hooks, types, backend responsibilities, and tests around existing buyer feature boundaries; split oversized responsibilities without artificial abstractions.
- [x] Preserve buyer-link authority, public projections, initial-submission deadlines, revocation/reissue behavior, retained input, correction handling, and seller-only/private boundaries.
- [x] Preserve Bengali/English presentation, entered data, stable error codes, focus behavior, and protection against repeated mutations when language changes.
- [x] Retain meaningful success/failure and access-boundary coverage; verify collection and fixture resolution after test moves.
- [x] Satisfy agreed source-size rules and document narrow test exceptions. If inventory finds no necessary change in an area, record the evidence rather than manufacturing a refactor.
- [x] Verify each bounded workflow with existing high-level rendered/API checks before starting the next; run final root `npm run check` and report browser/live gates separately.
- [x] Record changed responsibilities, dispositions, exceptions, checks, and remaining shared-infrastructure work.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Frontend: `frontend/src/features/buyer` (29 files; largest
  `BuyerSubmissionForm.tsx` 262), buyer tests (`BuyerRefresh` 232,
  `BuyerPortal` 212, plus submission/correction/locale suites), and
  `features/locale` buyer copy (coordinate with 08).
- Backend: `api/public_orders.py`, `api/link_access.py`, buyer/correction/link
  services and models, plus a cohesion review of `order_service.py` (293).
- Tests: `test_public_order_routes.py` 275, `test_buyer_corrections.py` 266,
  buyer PostgreSQL suites (skip without `BUYER_TEST_POSTGRES_URL`), and
  `test_order_routes.py` (423; serialize with 05 on its single ownership).
- Preserve buyer-link authority, deadlines, revocation/reissue, seller-only
  fields, retained input, corrections, localization, focus, and no-repeat writes.
- Do not refactor an area merely to lower a count. Record evidence if no change is
  needed; document any test exception.

**Required checks:** focused buyer backend/frontend tests per workflow, collection
and fixture resolution after moves, then `npm run check`. PostgreSQL/browser gates
are separate.


## Execution record (2026-10-29)

Base: `963469987d9bbb595c6505f69ba61b696cfdeede`, current branch, clean checkout.
Ticket 02 is implemented. Ticket 03 retains a stale ready-for-agent header, but
its completed checkboxes, final PASS record, and explicit next action authorize
starting 04; no dependency work was repeated.

### Responsibilities and dispositions

- Submission: extracted the recipient section into `BuyerContactFields.tsx` (73
  lines), alongside existing `PaymentClaimFields`, `PathaoLocations`, and
  `AddressAssistance`. `BuyerSubmissionForm.tsx` is now 205 lines and retains
  validation, first-error focus, fieldset locking, draft updates, and payload
  construction. Contact DOM names, IDs, labels, errors and localization keys are
  preserved; locale changes do not remount the component or trigger a write.
- `BuyerPortal` owns token-keyed session/draft state; `useBuyerSubmission` owns
  exact-payload/key retries and uncertain-outcome reconciliation; `usePublicOrder`
  owns refresh cancellation, access denial, backoff, and lifecycle monotonicity.
  These are cohesive existing boundaries (111/65/168 lines); retained intact.
- Status: `BuyerStatusView` (174) and `BuyerOrderDetails` (161) already separate
  lifecycle presentation from public terms. Existing refresh/locale/replacement
  tests are discoverable in the feature; no move or abstraction justified.
- Backend: public routes delegate to `BuyerService` (174), projection (62),
  revision (34), measurements (32), access policy, and link-access services.
  Correction/history are seller-authorized through separate correction routes
  and `buyer_correction.py` (150), not buyer-token operations. Retained intact.
  Models and locale copy already follow feature boundaries; no contract changes.
- `order_service.py` (293) review: seller creation, retrieval/listing and scoped
  token resolution share the order store/mapping facade. Buyer submission,
  projection, correction and access policy already live outside it. Its largest
  method is seller listing; moving that or its shared memory store here would
  expand seller/shared infrastructure scope. Retained for tickets 05/08 review.
- Split `test_order_routes.py` (423) into creation/validation/idempotency (181),
  `test_order_link_routes.py` (203: snapshot/link isolation/deadline), and
  `test_order_listing_routes.py` (67). All seven original test functions and
  their assertions are unchanged. Each module retains its local reset fixture;
  pytest collection and execution prove resolution. Ticket 05 should use these
  paths instead of recreating the old monolith; no concurrent owner was active.
- Reviewed `test_public_order_routes.py` (275) and `test_buyer_corrections.py`
  (266): cohesive route/privacy and correction/version/allocation scenarios,
  both below 300. No size exception required. PostgreSQL fixtures and suites
  remain in place. No tests/assertions were removed. No new seam was introduced;
  existing rendered/API seams explicitly required by this ticket were reused.
- Shared locale/auth/HTTP infrastructure and CSS remain with tickets 08/09;
  no migration, provider configuration or external state was changed.

### Verification

- Submission baseline and post-extraction: focused portal/locale-submission/retry
  tests, 3 files / 22 passed each time. `npm run typecheck`: both apps passed.
- After backend test split: order creation/link/listing, public routes and buyer
  boundaries: 21 passed, including all seven moved/original route scenarios.
- Buyer frontend cluster: `npm run test:frontend -- src/features/buyer`:
  13 files / 94 passed (retained input, errors/focus, locale switching, exact
  retries, access denial, status refresh, and replacement isolation).
- Correction/storage/models, buyer PostgreSQL transaction/boundary, link
  reissue/revocation suites: 46 passed / 17 skipped. PostgreSQL skips require
  `BUYER_TEST_POSTGRES_URL`; they are not database acceptance evidence.
- Final root `npm run check`: PASS at `.cache/checks/check-JAZjWr/result.json`: tooling, backend lint/types/tests (493 passed, 175 skipped), frontend lint/tests (78 files / 439 passed)/build, and HTTP smoke. Initial run `check-P1RMnq` stopped on Windows pytest temp-directory permission (492 passed, 175 skipped, 1 setup error); rerun used a fresh ignored `.cache/pytest-buyer04-*` directory via `PYTEST_ADDOPTS=--basetemp=...`, with no code workaround.
- Code-review skill: independent Standards and Spec agents reviewed against base `9634699`, including new files. Standards: 0 findings. Spec: 0 findings. Both verified unchanged original test functions; no follow-up changes required.
- Not run: real browser/keyboard/screen reader, physical device, hosted Clerk,
  PostgreSQL integration, live AI or Pathao. Offline tests do not establish these.
