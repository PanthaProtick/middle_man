# 01: Bounded Scroll Container and Pinned Filters for Orders List

**What to build:** An isolated, bounded scrolling container for the seller Orders list that prevents high-volume order lists from elongating the page. All section headers, order search controls, date range pickers, lifecycle filters, and export bars remain pinned above the scroll viewport. The scrolling container enforces overscroll containment so scrolling does not fling the browser page, maintains height stability during loading and empty states, and renders the "Load More" button at the bottom of the scroll list.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The orders list renders inside a dedicated `.ledger-scroll-viewport` container with responsive boundary constraints (`clamp(380px, 60vh, 680px)`) and `overflow-y: auto`.
- [ ] `overscroll-behavior-y: contain` prevents mouse-wheel and touch momentum from scroll-chaining to the outer window.
- [ ] Section headers, count indicators, search form, date controls, lifecycle filter, and export bar stay pinned above the scrolling container.
- [ ] The "Load More" / "আরও দেখুন" button renders inside the scroll container at the bottom of the order cards.
- [ ] Empty search/filter states and loading indicators maintain container height stability (`min-height: 360px`) with centered status messages.
- [ ] Component integration tests verify pinned controls remain outside and order cards/states render inside the scroll viewport.
