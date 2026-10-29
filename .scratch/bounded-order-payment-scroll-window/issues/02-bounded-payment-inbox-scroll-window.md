# 02: Bounded Scroll Container and Pinned Filters for Received Payments Inbox

**What to build:** An isolated, bounded scrolling container for the Received Payments Inbox ledger in the Payments tab. The SMS import panel, transaction search input, date range controls, and received-payment state filter remain pinned above the scroll viewport. The scrolling container encloses transaction cards, allows inline evidence resolution sub-panels to expand within the scroll flow without outer page elongation, and provides stable height for loading and empty states.

**Blocked by:** 01: Bounded Scroll Container and Pinned Filters for Orders List

**Status:** ready-for-agent

- [ ] The received payments inbox cards render inside the `.ledger-scroll-viewport` container with responsive height constraints and `overflow-y: auto`.
- [ ] The section header, transaction count badge, SMS import panel, search form, date controls, and transaction state dropdown stay pinned above the scroll viewport.
- [ ] `overscroll-behavior-y: contain` isolates scrolling gestures within the transaction ledger.
- [ ] Inline evidence resolution panels expand naturally inside the scroll flow without expanding the outer page.
- [ ] Empty-state and loading states maintain stable height (`min-height: 360px`) with centered status messages.
- [ ] The "Load More" button renders at the bottom inside the scroll viewport when a next cursor is available.
- [ ] Component integration tests verify pinned controls remain outside and transaction cards/states render inside the scroll container.
