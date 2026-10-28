# 03: Search received-payment records

**What to build:** A seller can search the Received Payments Inbox using identifiers visible in a payment app or their own records, combine search with existing reconciliation filters, and page through all matching seller transaction records.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] One inbox search field matches exact trimmed case-insensitive provider TrxID and internal receipt IDs, normalized full Bangladesh payment sender numbers, and seller-visible receiving account identity. Short numeric fragments do not match phone fields; raw SMS and private notes are not searched.
- [ ] Search is shop scoped, excludes retained records, applies before pagination on database and offline paths, and combines with existing conflicted, incomplete, unmatched, and used filters. A changed search or existing filter clears old rows and cursor; stale responses cannot repopulate them.
- [ ] Search remains out of the browser address bar and clears on refresh. English and Bengali controls, no-match guidance, loading state, and errors remain accessible and preserve input/focus.
- [ ] Focused received-transaction route and inbox/workspace tests cover each approved field, exact and partial nonmatches, phone normalization, receiving account isolation, combined filters, pagination, stale responses, offline behavior, and locale changes. Run root `npm run check` as the final gate; report browser acceptance separately.
