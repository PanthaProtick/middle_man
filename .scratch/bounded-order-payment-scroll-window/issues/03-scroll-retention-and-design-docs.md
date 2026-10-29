# 03: Scroll Position Retention and Design Documentation

**What to build:** Ensure scroll position is maintained across incremental updates and data refreshes in both the Orders list and Received Payments Inbox, so sellers do not lose their place when taking actions on items. Update the design and interaction documentation in `docs/ui-audience-and-design.md` to record the fixed-boundary ledger pattern, and verify the entire changes pass the repository verification gate (`npm run check`).

**Blocked by:** 01: Bounded Scroll Container and Pinned Filters for Orders List, 02: Bounded Scroll Container and Pinned Filters for Received Payments Inbox

**Status:** ready-for-agent

- [ ] In-place data refreshes and mutations preserve the current scroll position in the orders list and received payments ledger instead of resetting to the top.
- [ ] `docs/ui-audience-and-design.md` records the bounded scrolling ledger and pinned filter interaction pattern under interaction decisions.
- [ ] All code modifications adhere to line-count conventions (< 250 review, < 300 max).
- [ ] Full pre-handoff verification passes (`npm run check`), including types, linting, tests, and build.
