# Task: Orders and received-payments search and date filters

Status: In-Progress (ticket 01 complete; date and payment tickets remain)

- Goal: Add server-backed search and date filters to the seller Orders list and Received Payments Inbox, alongside their existing filters. Search and date filters also constrain the Orders CSV export.
- Scope exclusions: Do not filter accepted payment history inside an individual order, search raw SMS or private notes, add advanced query syntax, put search text in the browser address bar, or change the CSV's English columns.
- Agreed terminology: **Order creation date** is the order's `created_at`; **payment recorded date** is the received transaction record's `created_at`, distinct from its optional `occurred_at` payment time. “Last X days” means X Bangladesh calendar days including today.

## Acceptance cases

- Orders search covers order ID, product name, buyer name, and buyer contact number. Payments search covers provider TrxID, sender number, and receiving account; an exact internal receipt ID can also match. Text names and products use partial case-insensitive matching. Provider TrxID and internal IDs use exact trimmed case-insensitive matching. Full Bangladesh phone numbers match across `017…`, `+88017…`, and `88017…` forms; short numeric fragments are not phone searches.
- Each list offers Any time, custom inclusive from/to Bangladesh dates, Last 7/30/90 days, and custom Last X days (integer 1–3650). A reversed date range, zero or excessive X, and malformed dates show inline errors and do not send a request. A future end date is valid.
- Search, date, and existing lifecycle/review filters combine with AND semantics; fields within a search box combine with OR semantics. The server applies the complete shop-scoped predicate before pagination. Retained records remain excluded.
- Changing any filter starts at the first page and removes rows and cursors from the previous query. An in-flight response for an older query cannot replace or append to the new results. Loading more uses the same fixed date boundaries, including for Last X days. Empty-result guidance distinguishes no records from no matches. Search terms remain in workspace memory and clear on page refresh.
- The Orders CSV uses exactly the active order search, date, and lifecycle predicates across all matching pages, subject to the existing 500-order cap. If over 500 match, retain `EXPORT_TOO_LARGE` and explain that the seller must narrow filters. Do not silently export the first 500. Keep the existing CSV escaping, no-store headers, shop authorization, rate limit, and per-order summary behavior.
- English and Bengali labels, validation, and empty states remain available. Date-only controls display Bangladesh calendar dates; locale switching preserves selected filters without duplicate requests or repeated mutations. Keyboard focus and field values survive validation errors.
- Backend tests cover matching and nonmatching rows on both database and offline paths, date boundaries and timezone rollover, full-phone normalization, mixed filters, pagination, invalid inputs, shop isolation, and 500/501 export cases. Frontend tests cover query construction, cursor reset, stale-response rejection, validation, localization, export parameters, and empty states. Browser and live-provider behavior require separate acceptance.

## Relevant code and approach

- Current list routes are `backend/app/api/orders.py` and `backend/app/api/transactions.py`; their services are `backend/app/services/order_service.py` and `backend/app/services/transaction_service.py`. The Orders export route, model, and service are `backend/app/api/order_export.py`, `backend/app/models/order_export.py`, and `backend/app/services/order_export.py`.
- Current seller state and requests are in `frontend/src/features/seller/SellerWorkspace.tsx` and `api.ts`. Controls belong in `OrderList.tsx` and `TransactionInbox.tsx`; export parameters flow through `OrderExport.tsx`.
- Define typed, validated filter contracts shared conceptually by list and export, with one canonical order predicate for matching semantics. Convert inclusive Bangladesh dates to a half-open UTC interval before querying. Capture the Last X day boundary when the user applies the filter and reuse it for pagination and export.
- Keep the 500-order CSV cap. Existing list services load all shop rows before slicing, so search must not compound that cost: push selective date/search predicates and cursor pagination into the database query where possible, while maintaining an equivalent offline path. Do not put raw search terms in logs or audit events.
- Trade-offs: broad OR search across buyer and transaction fields may need targeted indexes or a separate search strategy as data grows; do not add indexes speculatively. A fixed relative window gives stable pagination, but a refresh or a newly applied preset recalculates it. Current cursor IDs alone may not guarantee a stable result if rows change between requests; test and define the expected refresh behavior during implementation.

## Current state

- Completed: Ticket 01 (Orders search and matching CSV export). Added one shared `search` predicate used by the list and export, trim/exact-ID/partial-name/full-phone normalization, shop and retained scoping, expiry-aware lifecycle filtering, database keyset pagination with an equivalent offline path, the 500-order export boundary, and Orders UI state with stale-response rejection. Search stays in workspace memory; loaded orders reload rather than bypass active filters.
- Completed earlier: Interviewed and confirmed all product decisions, including the 500-order export cap. Published the issue-tracker spec and four tracer-bullet tickets.
- Changed paths: `backend/app/services/order_search.py`, `order_service.py`, `order_export.py`, the order/export route/models, `frontend/src/features/seller/useSellerOrders.ts`, `SellerWorkspace.tsx`, `OrderList.tsx`, `OrderExport.tsx`, `api.ts`, locale copy, and focused backend/frontend tests.
- Next step: Pick up ticket 02 (Orders creation-date filter), reusing the shared predicate/query seam and extending list, export, and workspace tests.
- Resume: Inspect the current diff and ticket 02, then add the date contract and query predicates before UI controls.

## Verification

| Command or acceptance case | PASS / FAIL / BLOCKED / NOT RUN | Result or log path |
| --- | --- | --- |
| Design confirmed by user | PASS | Interview in this chat, 2026-10-28 |
| Focused backend tests (search, routes, export, shop isolation) | PASS | 25 tests; `tests/test_order_search.py`, `test_order_routes.py`, `test_order_export.py`, `test_shop_isolation.py` |
| PostgreSQL search path test | NOT RUN | `test_order_search_postgres.py` skips without `BUYER_TEST_POSTGRES_URL` |
| Focused frontend tests (search, export, locale, workspace) | PASS | 39 tests across `OrderSearch`, `OrderExport`, `OrderExportLocale`, `OrderLocale`, `SellerWorkspace` |
| Root `npm run check` | PASS | `.cache/checks/check-O7x0lC/result.json` (tooling, lint, types, backend/frontend tests, build, HTTP smoke) |
| Browser and live-provider acceptance | NOT RUN | Requires a real browser; local mocks and HTTP tests do not establish it |
