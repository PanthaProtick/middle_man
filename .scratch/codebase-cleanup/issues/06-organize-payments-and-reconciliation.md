# 06: Organize payment and reconciliation workflows

**Status:** ready-for-agent

**What to build:** Payment records, matching, corrections, and order outcomes whose code and tests are organized by responsibility while financial-history and concurrency safeguards remain intact.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [ ] Bound work using the inventory and trace seller UI, endpoint contracts, domain services, storage adapters, fixtures, and affected tests before editing.
- [ ] Organize payment entry/import, evidence/history, reconciliation, corrections, and outcomes through existing responsibility boundaries; do not change payment semantics.
- [ ] Preserve seller-supplied evidence authority, shop and receiving-account isolation, payment single-use protection, deterministic matching, atomic transitions, replay behavior, and failure recovery.
- [ ] Preserve retention/privacy behavior and the removal of buyer payment screenshot functionality; historical development evidence must not reintroduce that feature.
- [ ] Preserve Bengali/English presentation, stored business data, English CSV contracts, and no-repeat mutation behavior where affected.
- [ ] Split oversized test responsibilities without weakening existing boundary, replay, contention, PostgreSQL transaction, and failure assertions; record narrow cohesive-test exceptions and verify discovery.
- [ ] Verify one bounded workflow at a time using existing high-level seams; retain optional integration gates without introducing live-credential requirements for offline checks.
- [ ] Run final root `npm run check`; record actual PostgreSQL/live-provider gates, retained uncertainty, and all evidence-backed dispositions.

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

