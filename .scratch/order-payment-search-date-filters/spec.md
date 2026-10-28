# Orders and received-payments search and date filters

Status: ready-for-agent

## Problem Statement

Sellers cannot reliably find an older order or received-payment record by a familiar name, phone number, or transaction identifier. The existing lifecycle and reconciliation filters narrow only by status. Pagination makes a search of currently visible rows misleading, and the Orders CSV cannot yet reflect search or date selections.

## Solution

Give sellers one search field and one date filter in both the Orders list and Received Payments Inbox. Search and date selections combine with each section's existing filter across the seller's full eligible records. Offer Bangladesh calendar date ranges and Last X days presets or a custom day count. Keep result paging coherent when selections change. Make the Orders CSV use the same active filters, while preserving its explicit 500-order limit and English columns.

## User Stories

1. As a seller, I want to find an order by its ID, so that I can open a known order quickly.
2. As a seller, I want to find orders by part of a product name, so that I can locate a sale when I do not have its ID.
3. As a seller, I want to find orders by part of the buyer name, so that I can follow up with a buyer.
4. As a seller, I want to find orders by a full buyer contact number, so that I can locate the right order without scanning pages.
5. As a seller, I want common Bangladesh formats of the same full phone number to match, so that formatting differences do not hide a record.
6. As a seller, I want to find a seller transaction record by provider TrxID, so that I can reconcile it with a payment app or SMS.
7. As a seller, I want an exact internal receipt ID to find its record, so that I can follow a support reference.
8. As a seller, I want to find a received-payment record by full payment sender number, so that I can investigate a buyer payment proof.
9. As a seller, I want to find records by receiving account, so that I can examine payments to a particular account.
10. As a seller, I want search to ignore surrounding spaces and letter case where appropriate, so that routine input differences do not cause false misses.
11. As a seller, I want order creation dates to define the Orders date filter, so that results align with the date an order entered my list.
12. As a seller, I want payment recorded dates to define the Payments date filter, so that records without a known payment time remain findable.
13. As a seller, I want an inclusive from/to date range, so that I can examine a business period in Bangladesh time.
14. As a seller, I want Last 7, 30, and 90 days shortcuts, so that I can examine recent activity quickly.
15. As a seller, I want a custom Last X days option from 1 to 3650 days, so that I can choose another period.
16. As a seller, I want Any time to clear the date restriction, so that I can return to the whole eligible history.
17. As a seller, I want search and date to work with the existing lifecycle or received-payment state filter, so that I can narrow a specific work queue.
18. As a seller, I want the selected filters applied before pagination, so that later pages cannot hide matching records.
19. As a seller, I want a changed filter to restart at the first page, so that old rows do not mix with new results.
20. As a seller, I want a Last X days selection to keep the same dates while I load more, so that results do not shift during paging.
21. As a seller, I want a clear no-match message, so that I can distinguish a restrictive filter from a ledger with no records.
22. As a seller, I want invalid dates and day counts explained beside the controls, so that I can correct them without losing input or focus.
23. As a seller, I want the Orders CSV to reflect my active search, date, and lifecycle selections, so that the downloaded English report matches the list criteria.
24. As a seller, I want an explicit request to narrow filters when more than 500 orders match, so that I do not mistake a truncated CSV for a complete report.
25. As a seller, I want English and Bengali controls and feedback to preserve my selections when I change language, so that I can continue the same task.
26. As a seller, I want my search text absent from the browser address bar, so that sharing or copying the page URL does not expose it.
27. As a seller, I want only my shop's eligible records returned, so that other shops' orders or payments remain private.

## Implementation Decisions

- Add typed, validated search and date parameters to the seller Orders and received-transactions list contracts. Reuse the same canonical Orders predicate for CSV export so list and export matching cannot drift. Preserve existing lifecycle and received-transaction state parameters.
- Search terms are one trimmed term per section; there is no field selector, query language, or multi-term syntax. Search fields are OR alternatives within a section; search, date, and existing filters combine with AND semantics.
- Orders search covers order ID, product name, buyer name, and buyer contact number. Names and product names allow case-insensitive partial matches. IDs match exactly after trimming and case normalization. Full Bangladesh numbers normalize across local and `880`/`+880` formats; arbitrary short digit fragments do not match phone fields.
- Received-payment search covers provider TrxID, payment sender number, and receiving account. Exact internal receipt ID is an additional match. Provider TrxID and internal IDs use trimmed case-insensitive exact matching. The receiving account match must use seller-visible account identity and remain scoped to the same shop.
- Order date means the order creation date. Payment date means the seller transaction record creation date, distinct from its optional payment occurrence time. Date-only inputs use Asia/Dhaka calendar dates, inclusive at both ends; servers convert them to a half-open UTC interval. A future end date is valid.
- Date modes are Any time, custom from/to, and Last X days. The two bounded modes are mutually exclusive. Presets are 7, 30, and 90; custom X is an integer from 1 through 3650. Last X days includes today and the prior X minus one Bangladesh calendar days. Reversed ranges and malformed or out-of-range inputs display inline errors and do not issue a request.
- Capture relative date boundaries when the user applies them; reuse the same boundaries for later pages and CSV export. Applying a preset again or refreshing the page may calculate a new window.
- Apply all filters on the server before cursor pagination. Reset rows and cursor on a filter change. Prevent older in-flight responses from overwriting or appending to newer query results. Search state stays in the seller workspace and is not persisted into browser navigation or URL state.
- Preserve shop authorization, exclusion of retained records, private no-store responses, and current evidence boundaries. Do not search raw SMS, private notes, or buyer payment proof fields unrelated to the approved search. Do not log raw search terms.
- CSV returns the complete matching set only when it contains at most 500 orders. Preserve `EXPORT_TOO_LARGE` for 501 or more, with guidance to narrow filters; never silently truncate. Keep current CSV escaping, English columns, rate limit, and individual order summary behavior.
- Database queries should push selective predicates and pagination into storage instead of loading all shop rows before slicing. Keep the offline standby behavior equivalent. Evaluate indexes from measured query plans rather than adding them speculatively.
- Keep Bengali and English presentation changes at the display boundary. Changing language preserves filters and focus without causing extra requests or mutations.

## Testing Decisions

- Prefer externally observable tests at existing seller list and export HTTP seams: request parameters, response rows and cursors, errors, CSV content, shop isolation, and no-store behavior. Tests should exercise distinct cases and failure paths, not mirror private helper logic.
- Extend existing order route, received-transaction route, and order export suites. Cover database and offline paths, exact and partial matching, normalized full phones, short-digit nonmatches, receiving-account scoping, date endpoints and Bangladesh midnight, combined filters, retained-row exclusion, invalid inputs, and the 500/501 export boundary.
- Extend existing seller workspace, Orders export, Orders locale, and Received Payments Inbox component tests for query construction, filter combination, cursor reset, stale response rejection, accessible validation, empty states, export criteria, and language switching. These are the established UI test seams.
- Run focused tests after each backend and UI cluster and root `npm run check` as the final implementation gate. Local mocks and HTTP tests do not establish real-browser or live-provider acceptance.

## Out of Scope

- Search or date filtering of accepted payment history inside an individual order.
- Raw SMS or note search; fuzzy matching, short phone fragments, advanced query syntax, saved searches, or URL-persisted search terms.
- Unlimited or asynchronous exports, new CSV columns, and live payment-provider verification.
- Changes to underlying order, payment-claim, seller transaction record, reconciliation, retention, or courier decisions.

## Further Notes

- The current CSV endpoint has a deliberate 500-order safety limit; the product decision is to preserve it and show a clear narrowing message.
- Current list implementations read all eligible shop rows before slicing. Search must not compound that cost, and implementation should check cursor behavior when records change between requests.
- The repository glossary distinguishes seller transaction records from buyer payment proof; UI wording should preserve that distinction.
