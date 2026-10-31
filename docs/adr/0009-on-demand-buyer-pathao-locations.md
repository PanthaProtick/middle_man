---
status: proposed
---

# Fetch buyer Pathao locations on demand

The owner reports that fetching the complete city/zone/area hierarchy triggers
Pathao rate limits. Replace the persisted-catalogue prerequisite in
[ADR-0008](0008-persisted-buyer-pathao-location-catalog.md) with backend-mediated,
on-demand Pathao requests. The owner accepted the decisions below on 2026-10-31;
final confirmation of the complete design remains pending. This document does
not establish implemented or verified behavior.

## Agreed design

- Load cities when the form opens, zones for the selected city, and areas for
  the selected zone. Do not crawl unrelated branches.
- Preserve the current dropdown presentation, parent controls, descendant-only
  resets, entered details and stale-response protection.
- Reuse valid provider tokens, briefly cache requested lists, combine concurrent
  identical requests, and respect provider rate-limit cooldowns. Isolate results
  by shop, environment and connection revision; revoke authority on connection
  replacement or disconnection.
- Change buyer browsing and submission resolution together. Keep required-choice
  validation when choices are available, bearer-link safeguards and replay
  behavior. A client selection alone does not prove provider validity.
- If Pathao choices are unavailable, allow written-address submission, preserve
  entered details and explain the unavailable choices. Require seller location
  resolution before booking; seller review still checks current provider facts.
- Retire automatic full-hierarchy synchronization and its seller refresh/status
  controls. Leave existing database tables intact during this change.

## Consequences

Buyers no longer depend on a successful complete initial synchronization.
Uncached lists depend on Pathao latency and availability; caching, request
coalescing and token reuse reduce traffic but do not eliminate rate limits.
The existing snapshot-version contract must be retired or handled compatibly
across browsing and submission without discarding buyer-entered details.
