# 04: Filter received-payment records by recorded date

**What to build:** A seller can narrow the Received Payments Inbox by when a seller transaction record was recorded, combine that period with current search and reconciliation filters, and page through a stable result.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The inbox offers Any time, inclusive custom from/to Bangladesh dates, Last 7/30/90 days, and custom Last X days for integers 1–3650. Last X includes today and the prior X minus one Bangladesh calendar days.
- [ ] Date filtering uses the record creation date, including for records whose payment occurrence time is absent. It applies before pagination on database and offline paths and combines with search and existing reconciliation filters. Accepted payment history inside an individual order is unaffected.
- [ ] Invalid or reversed dates and invalid day counts show inline feedback without requests or loss of input/focus; a future end date is valid. A changed selection clears old rows and cursor, stale responses cannot overwrite results, and relative boundaries stay fixed while loading more.
- [ ] English and Bengali controls, validation, and empty states remain accessible and preserve the selection on language change without extra requests. Focused received-transaction route and inbox/workspace tests cover Bangladesh midnight, inclusive endpoints, mixed filters, pagination, stale responses, and offline behavior. Run root `npm run check` as the final gate; report browser acceptance separately.
