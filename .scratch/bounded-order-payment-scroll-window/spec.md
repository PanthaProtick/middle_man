# Bounded Scrolling Window for Orders and Received Payments

Status: ready-for-agent

## Problem Statement

When a seller manages an active shop with numerous orders or received payments, the orders list and received-payment transaction inbox expand vertically without constraint. As more items load or are imported, the entire webpage elongates significantly. This forces sellers to scroll excessively through the entire browser window to inspect items, pushes primary section headers, counters, search inputs, and date filters off-screen, and causes awkward page jumping ("scroll chaining") when scrolling through records on desktop or mobile.

## Solution

Introduce a fixed-boundary scrolling window for both the Orders list and the Received Payments Inbox. Keep all section headers, search fields, date range selectors, lifecycle/status dropdowns, and export controls pinned outside and above the scrolling container. Enforce an internal viewport with responsive vertical boundary clamping (`max-height: clamp(380px, 60vh, 680px)`), overscroll containment (`overscroll-behavior-y: contain`), and stable minimum height (`min-height: 360px`) during empty and loading states. Keep cursor-based pagination ("Load More") explicit at the bottom of the list and preserve the seller's scroll position during data refreshes.

## User Stories

1. As a seller, I want the orders list to be contained within a bounded scrolling window, so that a large volume of orders does not elongate the entire web page.
2. As a seller, I want the received payments inbox to be contained within a bounded scrolling window, so that dozens of transaction records do not stretch the page indefinitely.
3. As a seller, I want the order search and status filter bar to remain pinned above the orders list, so that I can filter or search without scrolling back to the top of the page.
4. As a seller, I want the received payment search, date controls, and transaction filter to remain pinned above the transactions ledger, so that I can refine my view at any point during review.
5. As a seller, I want mouse-wheel and trackpad scrolling inside the orders list to stay contained within the container, so that hitting the top or bottom of the list does not abruptly fling the outer browser window.
6. As a seller, I want mouse-wheel and trackpad scrolling inside the payments inbox to stay contained within the container, so that rapid scrolling does not trigger accidental page scroll-chaining.
7. As a seller, I want the scrolling list container to maintain a stable height during loading states, so that the layout does not bounce or collapse while data is being fetched.
8. As a seller, I want the scrolling list container to maintain a stable height when zero records match my search or date filters, so that applying filters does not cause jarring layout shifts.
9. As a seller, I want the empty-state and loading messages centered neatly inside the bounded container, so that status feedback is clear and visually balanced.
10. As a seller, I want the "Load More" / "আরও দেখুন" button to remain at the bottom of the scrollable list, so that I retain deliberate manual control over loading additional records without unexpected background data consumption.
11. As a seller, I want the container to preserve my current scroll position when an order or payment is updated in place, so that I do not lose my place in the list after recording a payment or resolving an item.
12. As a seller, I want inline expansion panels (such as evidence resolution under a transaction card) to expand inside the scrolling container, so that I can resolve a claim without disturbing the outer page layout.
13. As a seller, I want detailed order inspection dialogs to open as full-screen modal overlays, so that comprehensive order details and courier reviews have maximum focused space.
14. As a seller, I want the scrolling boundary to adapt smoothly across mobile and desktop screens, so that the list is neither cramped on small phones nor overly tall on large desktop monitors.
15. As a seller, I want clear visual boundary cues and subtle dividers below the pinned controls, so that I can immediately identify the list as an independently scrollable ledger.
16. As a seller, I want scrollbars to match the shop desk theme without distracting visual clutter, so that the interface remains restrained, readable, and professional.
17. As a seller, I want touch momentum scrolling to feel smooth and responsive on phone browsers, so that reviewing orders on a mobile device is effortless.
18. As a seller, I want switching between Bengali and English to preserve the bounded layout and scroll containment, so that language switching does not break the visual boundaries.
19. As a seller, I want the existing workspace tab navigation (Orders, Payments, Accounts, Retention) preserved, so that my operational workflow remains predictable.
20. As a seller, I want shop metrics and summary counters to stay visible above the scrollable window, so that I can keep track of totals while scrolling through records.

## Implementation Decisions

- Apply a shared `.ledger-scroll-viewport` container class in `frontend/src/styles/sections.css` for both the `OrderList` items container and the `TransactionInbox` items container.
- Configure `.ledger-scroll-viewport` with `overflow-y: auto`, `overscroll-behavior-y: contain`, `max-height: clamp(380px, 60vh, 680px)`, `min-height: 360px`, subtle borders (`border: 1px solid var(--border-subtle)`), rounded corners (`border-radius: var(--radius-sm)`), and padding for card spacing.
- Provide custom themed scrollbar rules (`scrollbar-width: thin`, `scrollbar-color: var(--border-subtle) transparent`) to maintain aesthetic alignment with the everyday shop desk theme.
- In `OrderList`, render the isolated section header, search form, status dropdown, `OrderDateControls`, and `OrderExport` component above the `.ledger-scroll-viewport`. Place the loading indicator, empty-state placeholder, the card list mapping `OrderCard`, and the `nextCursor` "Load More" button inside the `.ledger-scroll-viewport`.
- In `TransactionInbox`, render the isolated section header, transaction count badge, search form, date controls, filter selector, and refresh button above the `.ledger-scroll-viewport`. Place the loading indicator, empty-state placeholder, the card list mapping `TransactionCard` (and inline `EvidenceResolution`), and the `nextCursor` "Load More" button inside the `.ledger-scroll-viewport`.
- Preserve scroll position across data refetches by maintaining an internal DOM reference on the scrollable container and avoiding destructive unmounting of the viewport when queries update.
- Ensure all empty-state and loading-state wrappers inside the viewport flex-center their content vertically and horizontally within the `min-height: 360px` footprint.
- Keep `OrderDetailModal` and `ManualTransactionModal` as fixed viewport-level dialog overlays outside the scrolling containers.
- Document this interaction boundary in `docs/ui-audience-and-design.md` under interaction decisions.

## Testing Decisions

- Test at the highest existing component integration seam using React Testing Library in `OrderList.test.tsx` (or `OrderSearch.test.tsx`) and `TransactionInbox.test.tsx`:
  - Verify that the outer section controls (search input, status filter, date controls) remain outside the scroll viewport container.
  - Verify that the `.ledger-scroll-viewport` element encapsulates the rendered cards, loading indicator, and empty message.
  - Verify that the "Load More" button renders within the scrollable viewport below the item cards.
  - Verify that loading and empty states maintain the expected structure and accessible roles (`role="status"`, empty text announcements) within the container.
- Validate styling properties and CSS rule definitions in `frontend/src/styles/sections.css` to confirm `overflow-y: auto`, `overscroll-behavior-y: contain`, and min/max height bounds exist and conform to repository convention limits (< 250 lines review, < 300 lines max).
- Run the full verification suite (`npm run check`) to ensure strict TypeScript types, linting, file size limits, and test coverage all pass cleanly.

## Out of Scope

- Virtualized list rendering (e.g. `react-window` or `react-virtualized`): not required for current Phase 1 operational volumes, avoiding unnecessary bundle weight and accessibility degradation.
- Automatic infinite scrolling: rejected in favor of explicit manual "Load More" to respect mobile data constraints and predictable cursor pagination.
- Side-by-side or dual-pane workspace redesign: rejected to maintain mobile usability and preserve the existing tab navigation.
- Changes to backend APIs, database models, or pagination contracts.

## Further Notes

- Aligns with the core Phase 1 design philosophy in `docs/ui-audience-and-design.md`: everyday shop desk aesthetic, restrained animations, accessible touch targets, and resilient operational ergonomics for Bangladeshi social-commerce sellers.
