# 04: Find orders awaiting delivery preparation

**What to build:** Find outstanding delivery-preparation work in chat and apply the same query to the order dashboard.

**Blocked by:** 01: Unify the floating seller assistant and contextual review.

**Status:** ready-for-agent

- [ ] Use a shared backend-defined predicate over the full authorized shop dataset, not loaded-page filtering or simple negation of delivery_staged.
- [ ] Include confirmed orders awaiting courier preparation across older backlog. Exclude booked, submitting, unknown-outcome, terminal lifecycle, and separately categorized failed-submission cases; current attempt state and booking success override historical failures.
- [ ] Use Bangladesh calendar context without silently applying a created-today restriction. Support equivalent Bengali, English, Banglish, and mixed requests locally.
- [ ] Return a stable paginated preview, full matching total, retrieval time, useful reason labels, and application-generated open/copy-order-reference actions.
- [ ] Show in dashboard replaces conflicting search/date/status filters transparently and retrieves current data using exactly the same query; preserve the unfinished creation draft.
- [ ] Cover multi-page datasets, prior-day backlog, no matches, cross-shop exclusion, current/historical booking states, dashboard parity, freshness, and loading/error behavior.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

