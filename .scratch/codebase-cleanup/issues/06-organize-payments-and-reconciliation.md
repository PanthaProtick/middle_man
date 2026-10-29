# 06: Organize payment and reconciliation workflows

**Status:** implemented — reviewed and final root check passed

**What to build:** Payment records, matching, corrections, and order outcomes whose code and tests are organized by responsibility while financial-history and concurrency safeguards remain intact.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [x] Bound work using the inventory and trace seller UI, endpoint contracts, domain services, storage adapters, fixtures, and affected tests before editing.
- [x] Organize payment entry/import, evidence/history, reconciliation, corrections, and outcomes through existing responsibility boundaries; do not change payment semantics.
- [x] Preserve seller-supplied evidence authority, shop and receiving-account isolation, payment single-use protection, deterministic matching, atomic transitions, replay behavior, and failure recovery.
- [x] Preserve retention/privacy behavior and the removal of buyer payment screenshot functionality; historical development evidence must not reintroduce that feature.
- [x] Preserve Bengali/English presentation, stored business data, English CSV contracts, and no-repeat mutation behavior where affected.
- [x] Split oversized test responsibilities without weakening existing boundary, replay, contention, PostgreSQL transaction, and failure assertions; record narrow cohesive-test exceptions and verify discovery.
- [x] Verify one bounded workflow at a time using existing high-level seams; retain optional integration gates without introducing live-credential requirements for offline checks.
- [x] Run final root `npm run check`; record actual PostgreSQL/live-provider gates, retained uncertainty, and all evidence-backed dispositions.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Frontend: `ManualTransactionModal.tsx` 302 (split required), `TransactionCard.tsx`
  257, `TransactionInbox.tsx` 234, `TransactionSearch.test.tsx` 301,
  `TransactionDates.test.tsx` 262, `TransactionInbox.test.tsx` 257, payment
  accounts/evidence/retention panels.
- Backend: `transaction_service.py` 240, `reconciliation.py` 252,
  `reconciliation_db.py` 258, `payment_decision.py`, `payment_marker_protection.py`,
  `allocation.py`, `transaction_listing.py`, `transaction_search.py`, receipt/
  correction/evidence resolution services.
- Tests needing split/exception: `test_reconciliation.py` 809,
  `test_corrections_postgres.py` 671, `test_order_outcomes.py` 666,
  `test_transaction_routes.py` 462, `test_payment_marker_protection.py` 407,
  `test_payment_recovery_journey_postgres.py` 297. Preserve contention, replay,
  transaction, and failure assertions; keep PostgreSQL gating.
- Preserve evidence authority, shop/account isolation, single-use payments,
  deterministic matching, atomic/replay behavior, English CSV contracts, and the
  retired screenshot surfaces (ADR-0005, migration 0026).

**Required checks:** focused payment/reconciliation suites per workflow, optional
PostgreSQL suite with `BUYER_TEST_POSTGRES_URL`, then `npm run check`. Report
PostgreSQL and live-provider gates separately; do not run remote mutations.

### Implementation (2026-10-29)

Base: `f5db9ac3a0db11b94a1e8a9bbd9fac87ecf422c4`, current branch, clean checkout.
Ticket 02 is implemented. Ticket 03 has all acceptance items checked and its full
check passed; its stale ready-for-agent label does not represent remaining work.

The retained/moved responsibilities and size review are recorded in the existing
[disposition record](../disposition-record.md#ticket-06-payment-workflow-organization-2026-10-29).
No backend production code, endpoint contracts, schema, CSV format, localization
copy, retention behavior, or retired screenshot surface changed.

- Manual entry: `ManualTransactionModal.tsx` (223 lines) owns presentation;
  `useManualTransaction.ts` (110) owns draft state, validation, submission, errors,
  and the mount-scoped idempotency key. The state/API logic was moved intact.
- Reconciliation: `test_reconciliation.py` now covers arrival order and Bengali
  digits; new `test_reconciliation_competing_claims.py`,
  `test_reconciliation_boundaries.py`, and `test_reconciliation_recovery.py`
  separate contention, mismatch/isolation, and restart/late-claim protection.
  `reconciliation_support.py` holds existing shop/account/reset fixtures.
- Transaction routes: `test_transaction_routes.py` covers entry validation;
  `test_transaction_observations.py` covers duplicate/conflicting observations
  and replay; `test_transaction_visibility.py` covers listing/shop isolation and
  private buyer projections. `transaction_route_support.py` owns shared setup
  and clients. All existing consumers now import that support module directly.
- Outcomes: `test_order_outcomes.py`, `test_order_decision_guards.py`,
  `test_order_replacement.py`, and `test_order_replacement_guards.py` separate
  terminal decisions, decision guards, replacement behavior, and its guards.
- Marker protection: `test_payment_marker_protection.py`,
  `test_payment_marker_binding.py`, and `test_payment_marker_readiness.py`
  separate configuration/digests, historical bindings, and startup readiness.
- Durable correction: `test_corrections_postgres.py` retains the allocation race;
  `test_confirmed_delivery_correction_postgres.py` owns the complete durable
  correction story. Restored ordinary spacing between statements/arguments;
  preserved section boundaries, comments, and every database assertion.
- Search: `TransactionSearch.test.tsx` covers API parameters and accessible
  localized controls; `TransactionSearchWorkspace.test.tsx` covers stale requests,
  paging, failure/focus, and refresh. Shared synthetic helpers live in
  `transactionSearchTestSupport.tsx`. All five tests remain discovered.

### Verification (actual)

- Before changes: focused backend command over the original five suites collected
  56 tests: **54 passed, 2 PostgreSQL skipped**. Original three frontend suites:
  **3 files / 10 passed**.
- After split: focused backend command over the 16 resulting suites collected
  the same **56 tests: 54 passed, 2 PostgreSQL skipped**. A Python AST comparison
  verified every original test body, decorator, and assertion stayed identical;
  no duplicate tests or missing names. Temporary comparison scripts/data are in
  ignored `.cache/`, not the tracker.
- After extraction/search split: `npm run test:frontend --
  src/features/seller/ManualTransactionLocale.test.tsx
  src/features/seller/TransactionInbox.test.tsx
  src/features/seller/TransactionSearch.test.tsx
  src/features/seller/TransactionSearchWorkspace.test.tsx`: **4 files / 10 passed**.
- Initial typecheck identified an unused import in the new workspace suite;
  removed it. `npm run typecheck` then passed both applications.
- First full `npm run check`: tooling/lint/types passed; backend reached
  **492 passed / 175 skipped / 1 error** because pytest could not create its
  system temporary directory (`WinError 5`). Evidence:
  `.cache/checks/check-oARj1l/result.json`. No product-code fix was needed.
- Final full `npm run check`, with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-ticket06-final`:
  **PASS**, `.cache/checks/check-Z5WtcO/result.json`. All eight stages passed:
  tooling, backend lint/types/tests (**493 passed, 175 skipped**), frontend
  lint/tests (**81 files, 439 tests passed**)/build, HTTP smoke. Complete backend
  collection remains **668**, preserving discovery across the fixture consumers.
- `git diff --check` and staged whitespace checks passed.
- PostgreSQL is opt-in and skipped without `BUYER_TEST_POSTGRES_URL`; no remote
  mutations, live-provider, browser, hosted, physical-device, or screen-reader
  acceptance has run. Existing gates remain intact.

### Standards review

No actionable findings. The hook remains colocated with its payment UI, test
splits follow protected responsibilities, and shared fixtures now have explicit
support modules. The extraction preserves validation, state, callbacks, and the
idempotency-key lifecycle. No new baseline smell warrants a change. Existing
backend transaction boundaries remain intact. **0 findings**.

### Spec review

No findings. The independent reviewer compared all 56 original backend test ASTs:
each is present exactly once with identical bodies, decorators, and assertions.
Manual-entry state, validation, and mutation code moved verbatim apart from the
`FormEvent` type import. Fixture consumers use the extracted support module;
PostgreSQL gating, backend production code, contracts, localization copy, CSV,
retention, and retired screenshot surfaces remain unchanged. **0 findings**.

Both independent reviews used the starting commit as the fixed point and reviewed
the staged implementation before the final full gate. No fixes were requested.

Next action: commit this completed ticket on the current branch. Remaining
cleanup work follows the existing dependency graph; external acceptance gates
above remain explicitly unrun, not implied by this cleanup's local PASS.

