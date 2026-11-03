# 05: Inline Work Queries for Attention & Delivery Preparation

**What to build:** Enable natural language queries or suggestion chips for orders needing attention or awaiting delivery preparation to render concise, scrollable query summary cards directly inside the chat feed. Cards display current counts, order badges, and an actionable button to apply the corresponding filter to the main seller workspace dashboard.

**Blocked by:** 01: Chat Stream Layout & Conversational Shell

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Messages requesting attention backlog (e.g. "What orders need attention?", "Kaj ki baki?") or clicking the `[Attention backlog]` chip render an inline Attention Query card in the chat.
- [ ] Attention cards display total count and categorized items: unresolved reviews, failed courier submissions, uncertain bookings, and pending buyer submissions.
- [ ] Messages requesting delivery staging (e.g. "What orders are ready for delivery?", "Delivery preparation baki?") or clicking the `[Delivery preparation]` chip render an inline Delivery Preparation Query card in the chat.
- [ ] Preparation cards display the count of confirmed orders awaiting courier drafting.
- [ ] Query cards include a "View in Dashboard" action button that synchronizes and filters the main seller workspace view to that specific query.
- [ ] Individual order badges on query cards allow opening or inspecting specific orders.
- [ ] Integration tests verify query intent detection, data fetching, inline card rendering, and dashboard synchronization.
