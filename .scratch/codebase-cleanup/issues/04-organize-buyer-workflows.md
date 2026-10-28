# 04: Organize buyer workflows

**Status:** ready-for-agent

**What to build:** Buyer submission, correction, and status workflows with cohesive code and discoverable tests, preserving their externally observable behavior and access limits.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [ ] Use the inventory's bounded buyer targets; trace rendered flows, API callers, domain boundaries, and tests before editing.
- [ ] Organize affected UI, hooks, types, backend responsibilities, and tests around existing buyer feature boundaries; split oversized responsibilities without artificial abstractions.
- [ ] Preserve buyer-link authority, public projections, initial-submission deadlines, revocation/reissue behavior, retained input, correction handling, and seller-only/private boundaries.
- [ ] Preserve Bengali/English presentation, entered data, stable error codes, focus behavior, and protection against repeated mutations when language changes.
- [ ] Retain meaningful success/failure and access-boundary coverage; verify collection and fixture resolution after test moves.
- [ ] Satisfy agreed source-size rules and document narrow test exceptions. If inventory finds no necessary change in an area, record the evidence rather than manufacturing a refactor.
- [ ] Verify each bounded workflow with existing high-level rendered/API checks before starting the next; run final root `npm run check` and report browser/live gates separately.
- [ ] Record changed responsibilities, dispositions, exceptions, checks, and remaining shared-infrastructure work.

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

