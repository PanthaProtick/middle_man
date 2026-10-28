# 03: Search received-payment records

**What to build:** A seller can search the Received Payments Inbox using identifiers visible in a payment app or their own records, combine search with existing reconciliation filters, and page through all matching seller transaction records.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] One inbox search field matches exact trimmed case-insensitive provider TrxID and internal receipt IDs, normalized full Bangladesh payment sender numbers, and seller-visible receiving account identity. Short numeric fragments do not match phone fields; raw SMS and private notes are not searched.
- [x] Search is shop scoped, excludes retained records, applies before pagination on database and offline paths, and combines with existing conflicted, incomplete, unmatched, and used filters. A changed search or existing filter clears old rows and cursor; stale responses cannot repopulate them.
- [x] Search remains out of the browser address bar and clears on refresh. English and Bengali controls, no-match guidance, loading state, and errors remain accessible and preserve input/focus.
- [x] Focused received-transaction route and inbox/workspace tests cover each approved field, exact and partial nonmatches, phone normalization, receiving account isolation, combined filters, pagination, stale responses, offline behavior, and locale changes. Run root `npm run check` as the final gate; report browser acceptance separately.

## Implementation notes

### Decisions

- One trimmed term matches, within the seller's shop and excluding retained records: exact
  case-insensitive provider TrxID, exact case-insensitive internal receipt ID, partial
  case-insensitive receiving-account label, complete normalized payment sender number, and
  complete normalized receiving-account number. Short phone fragments never match phone
  fields; raw SMS text and buyer claims are not searched.
- `app/services/transaction_search.py` owns normalization, the SQL predicate, and its
  offline equivalent (same case/substring/phone semantics on both sides).
  `app/services/transaction_listing.py` owns the shop-scoped list query, the
  search-aware outer join to `payment_accounts` (joined on account and shop), the
  reconciliation-filter composition, and cursor paging for both database and offline
  paths. Search is pushed into SQL; the existing Python filter/pagination order is
  preserved so paging behavior did not change in this ticket.
- Route parameter is `search` (maximum 200 characters). `docs/API_CONTRACTS.md` documents
  the fields, phone normalization including Bengali digits, filter combination, retained
  exclusion, and the no-URL-state rule.
- Frontend: `useTransactionInbox` owns filter/search/paging and request sequencing
  (matching the shipped Orders hook pattern); `TransactionInbox` requires the search
  value and change handler, adds the labelled search form (Enter re-applies the term),
  a loading status, and search-specific no-match copy. Manual payment records re-query
  instead of inserting whenever a search or filter is active.
- Each keystroke re-queries, exactly as the shipped Orders search does. The Search button
  and Enter re-apply the current term without changing it.
- Two extractions were made after review to satisfy the repository file-size invariant:
  the received-transaction listing (from `TransactionService`) and the workspace shop
  bootstrap (from `SellerWorkspace`, which was already over 300 lines). Both are
  behavior-preserving and covered by existing suites.

### Changed paths

- Backend: `backend/app/api/transactions.py`,
  `backend/app/services/transaction_service.py`,
  `backend/app/services/transaction_listing.py`,
  `backend/app/services/transaction_search.py`,
  `backend/tests/test_transaction_search.py`,
  `backend/tests/test_transaction_search_postgres.py`.
- Frontend: `frontend/src/features/seller/{api.ts,useTransactionInbox.ts,useSellerBootstrap.ts,TransactionInbox.tsx,PaymentsSection.tsx,SellerWorkspace.tsx,TransactionSearch.test.tsx}`,
  `frontend/src/features/locale/paymentInboxCopy.ts`.
- Docs: `docs/API_CONTRACTS.md`.

### Checks

- `npm run test:backend -- tests/test_transaction_search.py` (6 passed).
- `npm run test:backend -- tests/test_transaction_routes.py tests/test_sms_import.py`
  (20 passed).
- PostgreSQL (disposable loopback schema via `BUYER_TEST_POSTGRES_URL`):
  `tests/test_transaction_search_postgres.py tests/test_sms_postgres.py tests/test_structured_retention_postgres.py tests/test_reconciliation_postgres.py`
  (16 passed), proving the database list path, search join, filters, paging, and shop scope.
- `npm run test:frontend -- src/features/seller/TransactionSearch.test.tsx` (5 passed).
- Root `npm run check` (`.cache/checks/check-z6TV07`) passed all eight stages: backend
  488 passed / 174 skipped (PostgreSQL opt-in), frontend 433 passed, build, and HTTP smoke.

### Unresolved risks

- Database paging still filters and slices in Python after the SQL search predicate; the
  ticket allowed this, but the spec's "push pagination into storage" preference remains
  for a later ticket.
- Real-browser acceptance of the loading, failure, locale, and focus states is NOT RUN;
  component tests do not prove browser behavior.
- Per-keystroke live search matches the Orders precedent but issues one request per
  keystroke; no debounce was specified.

### Next action

Ticket 04 extends `transaction_listing.list_shop_transactions` and the
`useTransactionInbox` query with recorded-date bounds; it can also move the remaining
reconciliation filters and keyset paging into storage.
