# 05: Find and prioritize orders needing attention

**What to build:** Show actionable outstanding order work with consistent reasons, priority, counts, and dashboard navigation.

**Blocked by:** 04: Find orders awaiting delivery preparation (shared work-query and dashboard-filter behavior).

**Status:** ready-for-agent

- [ ] Include pending buyer submissions including uncoded reviews, awaiting preparation, current failed courier submissions, and unknown-outcome bookings.
- [ ] Exclude awaiting-buyer, completed bookings, cancelled/rejected/expired orders. Active submissions display progress rather than an immediate-action item; successful/current attempt state supersedes historical failures.
- [ ] Deduplicate orders and show applicable reasons; prioritize unknown bookings, failed submissions, pending reviews, then preparation, with oldest outstanding work first and stable pagination.
- [ ] Compute category priority and ordering from authoritative lifecycle/attempt facts; document the chosen outstanding timestamps and tie-breaker and keep dashboard/chat semantics identical.
- [ ] Include older unresolved backlog under Bangladesh-today context; provide totals, retrieval time, paginated results, open/copy-reference actions, and clearly labelled replacement dashboard filters.
- [ ] Support bilingual/mixed workflow requests without external-model dependency and preserve pending creation drafts during searches.
- [ ] Test overlapping categories, uncoded reviews, historical/current attempts, pagination and ordering, midnight/backlog cases, no results, ownership, query parity, and stale results.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

