# 05: Organize seller shell and order workflows

**Status:** ready-for-agent

**What to build:** Maintainable seller navigation, onboarding, order creation, and order details with colocated behavior tests and unchanged user interactions.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [ ] Use inventory-bounded targets and trace UI callers, state ownership, API contracts, and tests before changing each workflow.
- [ ] Organize shell and order responsibilities within existing feature boundaries, decomposing oversized components without adding generic layers solely for line counts.
- [ ] Preserve navigation/history behavior, onboarding/session states, form values, accessible focus, order creation, details, and buyer-link actions.
- [ ] Preserve localization, entered business data, error recovery, and no-repeat mutation behavior.
- [ ] Preserve backend authority and payload contracts; coordinate shared ownership through the disposition record rather than duplicating helpers.
- [ ] Keep meaningful rendered interaction and API coverage discoverable; follow agreed source-size rules and document narrow test exceptions.
- [ ] Verify each bounded workflow before the next, then run final root `npm run check`; identify browser/device acceptance not run.
- [ ] Record evidence-backed no-change findings where applicable, moved/deleted files, results, and shared follow-up targets.

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

