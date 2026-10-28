# 02: Filter Orders and export by creation date

**What to build:** A seller can narrow orders by their creation date in Bangladesh time, combine the date selection with current search and lifecycle filters, page consistently, and export the same selected period.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Orders offer Any time, inclusive custom from/to Bangladesh dates, Last 7/30/90 days, and custom Last X days for integers 1–3650. Last X includes today and the prior X minus one Bangladesh calendar days.
- [ ] Invalid or reversed dates and invalid day counts show inline feedback without a request or loss of input/focus. A future end date is allowed. Date mode changes do not leave conflicting range and relative selections active.
- [ ] Date filtering uses order creation time, applies before pagination on database and offline paths, and combines with lifecycle and any search term. A changed selection clears old rows and cursor; old responses cannot overwrite the new result. Relative boundaries remain fixed while loading more or exporting.
- [ ] The English Orders CSV uses the same date boundaries and all other active criteria; it includes every match up to 500 and explicitly rejects more than 500. Existing CSV privacy and formatting behavior stays intact.
- [ ] English and Bengali controls and feedback preserve the selection on language change without extra requests. Focused route/export and workspace tests cover Bangladesh midnight, inclusive endpoints, invalid inputs, mixed filters, pagination, stale responses, and export boundaries. Run root `npm run check` as the final gate; report browser acceptance separately.
