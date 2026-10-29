# 05: Organize seller shell and order workflows

**Status:** implemented — reviewed and locally verified

**What to build:** Maintainable seller navigation, onboarding, order creation, and order details with colocated behavior tests and unchanged user interactions.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [x] Use inventory-bounded targets and trace UI callers, state ownership, API contracts, and tests before changing each workflow.
- [x] Organize shell and order responsibilities within existing feature boundaries, decomposing oversized components without adding generic layers solely for line counts.
- [x] Preserve navigation/history behavior, onboarding/session states, form values, accessible focus, order creation, details, and buyer-link actions.
- [x] Preserve localization, entered business data, error recovery, and no-repeat mutation behavior.
- [x] Preserve backend authority and payload contracts; coordinate shared ownership through the disposition record rather than duplicating helpers.
- [x] Keep meaningful rendered interaction and API coverage discoverable; follow agreed source-size rules and document narrow test exceptions.
- [x] Verify each bounded workflow before the next, then run final root `npm run check`; identify browser/device acceptance not run.
- [x] Record evidence-backed no-change findings where applicable, moved/deleted files, results, and shared follow-up targets.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Frontend: `SellerWorkspace.tsx` 270, `OrderDetailModal.tsx` 316 (split
  required), `api.ts` 294 (review; 08 coordinates the shared client),
  `SellerWorkspace.test.tsx` 401 (split/exception), `OrderDates.test.tsx` 325,
  `CreateOrderModal.test.tsx` 268, plus order/search/export suites.
- Backend: `api/seller.py`, `api/orders.py` 239, `seller_service.py` 292,
  `order_service.py` 293 (serialize with 04), `models/entities.py` 284, order
  search/dates/mapping services.
- Tests: `test_order_routes.py` 423, `test_order_dates.py` 333,
  `test_order_search.py` 254, seller storage/route/isolation suites.
- Preserve navigation/history, onboarding/session states, form values, accessible
  focus, order creation/details, buyer-link actions, payloads, localization, and
  no-repeat mutations.
- Split `OrderDetailModal.tsx` by responsibility (inspection sections vs dialog
  state), not by arbitrary line count; keep rendered behavior tests.

**Required checks:** focused seller/order frontend/backend tests after each
workflow, build/typecheck for moved components, then `npm run check`. Record
browser/device acceptance not run.


## Execution record (2026-10-29)

Base: `b5630fbc61396b1b58f7c4a2d8d69026d59bd8cd`, current branch, clean checkout.
Dependencies 02/03 have execution evidence; 03 retains an old ready status but
records completed deletion, focused/full checks and retained reachable features.
Ticket 04 already split order-route tests; those paths were reused.

### Decisions and changed paths

- `OrderDetailModal.tsx`: 316 -> 163 lines. Extracted `OrderOverview.tsx` (87)
  for terms/deadlines/developer details and `OrderPaymentDetails.tsx` (112) for
  allocation/review/account snapshot and payment actions. Dialog owns order,
  courier status, selected tab, keyboard navigation and focus restoration.
  Payment details owns its expanded-code state. All panels remain mounted with
  `hidden`, preserving drafts, local expansion and request/mutation lifetimes.
  Existing callback, child keys, wrappers, copy, styling and API payloads remain.
- Split `SellerWorkspace.test.tsx` into rendered shell tests (262) and
  `sellerApi.test.ts` (141): client normalization/header/payload tests are now
  discoverable independently from onboarding, sign-in, error/retry and inspection.
- Split `OrderDates.test.tsx` into selection/validation (107),
  `OrderDateRequests.test.tsx` (121: pagination/export/stale responses/locale),
  and `orderDatesTestSupport.tsx` (105: shared rendered setup, fetch mock, cleanup).
- Split `test_order_dates.py` into list/bounds (176),
  `test_order_export_dates.py` (114: filter parity and 500-row boundary), and
  `order_dates_support.py` (76: shared setup/data builders). Reset fixtures remain
  explicit in each discovered module. All original tests/assertions retained.
- No files deleted; content moved only to the named colocated files. No new test
  seam or behavior added; existing rendered component and HTTP contracts are the
  refactoring safety net, so no new TDD seam requires approval.

### Reviewed and retained

- `SellerWorkspace.tsx` (270): orchestration of existing feature hooks and section
  components. `App` keys it by session; controlled/internal section selection,
  bootstrap/setup/recovery, list refresh and modal lifetime stay here. Further
  extraction would move the same large callback/prop surface without hiding a
  separate responsibility. Navigation/history ownership is unchanged.
- Creation already separates `CreateOrderModal` presentation, `useOrderCreation`
  submission/validation/idempotency, and parcel state. Retained to protect input,
  focus, retry and duplicate-submit behavior. `CreateOrderModal.test.tsx` (268),
  `SellerSession.test.tsx` (259), rendered workspace (262) and backend search
  (254) are below 300 and cohesive; no size exception needed.
- `api.ts` (294): existing shared seller client facade with session request/error
  handling and explicit endpoint payloads; retained for ticket 08's coordinated
  shared-client review. No parallel endpoint/helper implementation introduced.
- `seller_service.py` (292): shop/account store facade sharing idempotency and
  durable/offline storage behavior; account extraction intersects ticket 06 and
  would change an existing shared service interface. Retained for 06/08.
- `order_service.py` (293): seller order creation/list/get/token-resolution facade
  shares storage, mapping and shop isolation. Buyer submission/corrections are
  already separate (ticket 04 evidence). Retained; no backend runtime changes.
- `models/entities.py` (284): shared SQLAlchemy metadata/foreign-key model graph;
  splitting creates shared infrastructure ownership churn, coordinated by 08.
- Seller/order routes remain typed authorization/response boundaries. Traced
  `OrderList` inspection caller, order creation hook, bootstrap hook, route/service
  owners, API contract documentation, and the existing interaction/API suites.

### Verification

- Before extraction: focused inspection/workspace/locale/courier-status/buyer-copy
  tests passed, 4 files / 19 tests. Same tests passed after extraction.
- Shell/creation/session/date/app/client focused tests passed, 9 files / 55 tests.
- Backend dates/export/routes/links/listing/search/seller tests passed, 30 tests.
  Initial split missed imports; corrected and reran successfully.
- `npm run typecheck` passed after correcting moved TypeScript imports.
- Independent code-review skill: Standards 0 findings; Spec 0 findings. Review
  compared staged changes to the starting commit and confirmed original test
  cases/assertions, panel lifetimes, callbacks and contracts were preserved.
- First final root check failed at the existing smoke-environment test's
  `tmp_path` setup (Windows system temp PermissionError): 492 passed, 175 skipped,
  1 setup error. Evidence: `.cache/checks/check-aS0d4d/result.json`.
- Reran full root `npm run check` with shell-local
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-ticket05-final`: PASS,
  `.cache/checks/check-0sVdsk/result.json`. All eight stages passed: tooling,
  backend lint/types/tests (493 passed, 175 skipped), frontend lint/tests
  (80 files, 439 passed), production build/types and HTTP smoke. PostgreSQL tests
  requiring external test database configuration remain skipped.
- Not run: real browser/keyboard acceptance, physical devices, hosted sessions,
  live payment providers or Pathao. Local tests do not establish those outcomes.

Next action: continue ticket 06 or 07; ticket 08 owns the shared follow-ups above.
Ticket 05 is complete locally; browser/device/provider acceptance remains unrun.
