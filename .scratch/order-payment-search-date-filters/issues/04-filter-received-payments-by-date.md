# 04: Filter received-payment records by recorded date

**What to build:** A seller can narrow the Received Payments Inbox by when a seller transaction record was recorded, combine that period with current search and reconciliation filters, and page through a stable result.

**Blocked by:** None (can start immediately).

**Status:** implemented

- [x] The inbox offers Any time, inclusive custom from/to Bangladesh dates, Last 7/30/90 days, and custom Last X days for integers 1–3650. Last X includes today and the prior X minus one Bangladesh calendar days.
- [x] Date filtering uses the record creation date, including for records whose payment occurrence time is absent. It applies before pagination on database and offline paths and combines with search and existing reconciliation filters. Accepted payment history inside an individual order is unaffected.
- [x] Invalid or reversed dates and invalid day counts show inline feedback without requests or loss of input/focus; a future end date is valid. A changed selection clears old rows and cursor, stale responses cannot overwrite results, and relative boundaries stay fixed while loading more.
- [x] English and Bengali controls, validation, and empty states remain accessible and preserve the selection on language change without extra requests. Focused received-transaction route and inbox/workspace tests cover Bangladesh midnight, inclusive endpoints, mixed filters, pagination, stale responses, and offline behavior. Run root `npm run check` as the final gate; report browser acceptance separately.

## Implementation evidence (2026-10-28)

- Added typed from_date/to_date received-transaction parameters using inclusive Bangladesh creation-date bounds, including missing occurred_at records. Date, search and reconciliation predicates run before SQL limit/keyset paging; offline ordering is equivalent. Cursor anchors remain usable after reconciliation or retention changes.
- Reused localized date controls and extracted shared useDateSelection for Orders and Received Payments Inbox. Draft validation preserves focus/input without requests; explicit captured dates stay fixed across paging, stale responses are rejected, and language changes preserve selection without requests. Accepted per-order payment history is unaffected.
- Changed paths: backend/app/api/transactions.py; backend/app/services/transaction_listing.py; backend/tests/test_transaction_dates.py; backend/tests/test_transaction_search_postgres.py; frontend/src/features/seller/{OrderDateControls,PaymentsSection,SellerWorkspace,TransactionInbox,api,useSellerOrders,useTransactionInbox,useDateSelection,TransactionDates.test}; frontend/src/features/locale/paymentInboxCopy.ts; docs/API_CONTRACTS.md.
- Focused checks: transaction route/date/search 22 passing tests across runs; date/search UI suites 18 passed; npm run typecheck passed.
- Review: Standards 0 findings; Spec 1 P2 retained-cursor pagination finding, reproduced with a failing route test and fixed with SQL/offline anchor resolution independent of result eligibility.
- Final gate: npm run check PASS with PYTEST_ADDOPTS=--basetemp=E:/middle_man/.scratch/pytest-payment-dates-final. Result: .cache/checks/check-qlzt9z/result.json; 493 backend passed / 175 skipped, 437 frontend passed; tooling, lint, types, build and HTTP smoke passed. Earlier attempts caught import sorting, then Windows default-temp permission failure; both resolved.
- NOT RUN: real-browser/device acceptance and PostgreSQL integration (no BUYER_TEST_POSTGRES_URL disposable loopback target configured). Added PostgreSQL regression remains skipped; local mocks/HTTP checks do not establish those gates.
- Next action: optional browser and disposable-PostgreSQL acceptance; implementation complete.

- Commit authorization: user explicitly approved committing these verified changes directly to main after automatic approval review requested branch-specific approval.
