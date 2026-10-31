# Restore on-demand buyer Pathao location choices

Status: ready-for-agent
Date: 2026-10-31
Baseline inspected: f817ef2aa768171c73adf4e19a50129bfdffa410.
Scope: location-source replacement with current buyer presentation retained.

## Problem Statement

Buyers cannot reliably select delivery locations because their choices depend on
an initial complete Pathao location catalogue synchronization. Fetching every
city, zone and area requires many provider requests; the owner reports that Pathao
responds with too many requests. Without a successfully published catalogue,
individual buyers cannot browse even the small part of the hierarchy they need.

The existing investigation also recorded authentication rate limiting after
successful individual location probes. A pending change reuses one token per
complete crawl, but does not remove the full-hierarchy request volume or initial
synchronization prerequisite. Restoring the old implementation verbatim would
retain authentication per list-cache miss and is insufficient.

## Solution

Load Pathao location choices through our backend only as buyers need them: cities
when the form opens, zones when a city is selected, and areas when a zone is
selected. Buyers keep the current dropdown presentation and entered details.

Reuse valid tokens, briefly cache requested lists and combine concurrent requests
for identical lists within the applicable merchant connection. Respect provider
cooldowns. If choices remain unavailable, buyers can submit their written address
and payment claim; the seller must resolve the destination before booking.

Retire full-hierarchy synchronization and its seller refresh/status controls.
Keep existing database tables intact. Change browsing and submission validation
together so neither depends on a persisted catalogue being present.

## User Stories

1. As a buyer, I want city choices when I open my buyer link, so that I can begin entering my delivery destination.
2. As a buyer, I want zones for my selected city, so that I only see relevant destinations.
3. As a buyer, I want areas for my selected zone, so that I can complete my destination selection.
4. As a buyer, I want location choices without a complete catalogue synchronization, so that another city's data does not prevent my submission.
5. As a buyer, I want the current dropdown presentation retained, so that this change does not require learning a different form.
6. As a buyer, I want selected parent controls to remain usable while children load, so that I can correct a selection immediately.
7. As a buyer, I want only dependent choices cleared after a parent changes, so that unrelated entered details survive.
8. As a buyer, I want late responses for previous selections ignored, so that they cannot replace my current choices.
9. As a buyer, I want previously fetched lists remembered within my form, so that returning to a selection avoids unnecessary loading.
10. As a buyer, I want my name, contact number, written address and payment claim preserved through lookup failures, so that I do not repeat my work.
11. As a buyer, I want unavailable choices clearly explained, so that I know whether to retry or submit my written address.
12. As a buyer, I want written-address submission when Pathao is unavailable, so that a provider outage does not discard my order details.
13. As a buyer, I want a missing Pathao connection handled clearly, so that I can still provide my written address.
14. As a buyer, I want empty location lists handled without invented choices, so that my delivery details remain accurate.
15. As a buyer, I want a zone without areas handled honestly, so that I am not required to choose a nonexistent area.
16. As a buyer, I want existing unsupported-destination reporting retained, so that the seller knows when I have a coverage concern.
17. As a buyer, I want required available choices identified with accessible field feedback, so that I can correct an incomplete destination.
18. As a buyer, I want loading and failure guidance in my selected language, so that I understand how to proceed.
19. As a buyer, I want language switching to preserve my form without extra location requests, so that presentation changes do not disrupt selection.
20. As a buyer, I want an accepted submission retry to return its original result, so that a later Pathao outage does not invalidate my submission.
21. As a seller, I want unresolved buyer destinations clearly marked, so that I know which orders need location resolution.
22. As a seller, I want booking blocked until destination review succeeds, so that written-address fallback cannot accidentally authorize delivery.
23. As a seller, I want current Pathao checks during courier review, so that cached buyer choices do not establish booking readiness.
24. As a seller, I want full-catalogue refresh and status controls removed, so that settings no longer advertise an unused synchronization workflow.
25. As a seller, I want connection, environment and pickup settings retained, so that I can still manage my Pathao account.
26. As a seller, I want requests to reuse valid authentication, so that ordinary buyer activity does not repeatedly authenticate.
27. As a seller, I want identical concurrent location requests combined, so that simultaneous buyers do not generate avoidable provider traffic.
28. As a seller, I want provider cooldowns respected, so that retries do not prolong rate limiting.
29. As a seller, I want my merchant connection isolated from other shops and environments, so that another account's choices or credentials cannot affect my orders.
30. As a seller, I want replaced or disconnected credentials to revoke old location authority, so that obsolete cached data cannot validate new submissions.
31. As an operator, I want connection events and scheduled jobs to stop starting complete location crawls, so that the rejected request pattern cannot continue in the background.
32. As an operator, I want existing catalogue tables retained during the change, so that source replacement does not require destructive database cleanup.
33. As an operator, I want unrelated seller workflows preserved, so that this bounded source replacement does not roll back other improvements.
34. As a developer, I want deterministic offline location behavior and provider-failure fixtures, so that verification does not require live credentials.

## Implementation Decisions

- Retain backend-mediated city, zone and area lookup interfaces. Never expose
  merchant credentials or make the browser contact Pathao directly. This remains
  a fixed hierarchy interface, not an arbitrary provider proxy.
- Replace snapshot-dependent buyer browsing and submission resolution together.
  A connected shop with no saved catalogue must be able to retrieve individual
  lists and submit validated choices.
- Fetch only requested branches. Validate parent membership using requested or
  cached lists; do not enumerate unrelated cities or zones during validation.
- Preserve the existing five-minute list-cache behavior as a starting point.
  Keep caching bounded and scope keys by shop, environment, connection revision,
  hierarchy level and parent. Do not share merchant-derived data across scopes.
- Reuse unexpired tokens according to provider expiry. Keep credentials and tokens
  server-side and out of persisted location data, public responses and logs.
- Coalesce matching in-flight requests within a process. Ensure failures release
  waiters and permit later recovery; cancellation must not leave a permanently
  pending entry. Do not claim process-local coordination is deployment-wide.
- Respect provider cooldowns, including valid retry guidance, and use bounded
  backoff where guidance is absent. Avoid immediate retry loops or token issuance
  storms. Never represent a provider error as a successful empty catalogue.
- A valid cached list may serve eligible requests during a provider problem.
  Do not extend its lifetime silently or create an unagreed indefinite stale mode.
- Recheck buyer-link and connection authority before using cached data. Recheck
  connection revision after provider work before accepting results or rejecting
  a submission based on potentially obsolete membership information.
- Preserve required-choice and hierarchy checks when choices are available.
  Known invalid IDs and mismatched parents remain validation errors; client claims
  of outage, labels or resolved status cannot bypass server-derived facts.
- Preserve established fallback semantics for unavailable/disconnected providers,
  empty lists, unsupported destinations and zones with no areas. Discard unverified
  IDs and labels while retaining written address and payment claim. Keep explicit
  unsupported coverage concerns until the seller resolves them.
- Do not equate an in-flight lookup with established unavailability. Preserve
  the current guard against submitting incomplete choices while loading.
- Keep fallback submissions blocked for booking until seller resolution. Retain
  fresh seller-review checks and existing booking safeguards independently of
  buyer caches; buyer selection does not prove booking readiness.
- Retain original-payload retry identity and accepted replay behavior. Accepted
  retries must not require new location fetches or a saved catalogue.
- Retire snapshot-version authority across lookup and submission. Handle already
  open forms carrying the old optional version compatibly: it cannot authorize
  stale choices or force a database-snapshot dependency. Preserve original retry
  payload identity, including legacy fields, rather than rewriting accepted data.
- Preserve current dropdown interactions, descendant-only resets, remembered
  lists, stale-response protection, accessible feedback and Bengali/English copy.
- Remove automatic full-hierarchy crawl triggers from connection handling and
  scheduled execution, and retire seller manual-refresh/status surfaces and their
  executable synchronization entry points. Preserve account connection and
  disconnection, environment selection, pickup settings and unrelated seller UI.
- No destructive schema migration is required. Existing snapshot tables and
  historical records remain intact; they no longer gate buyer location choices.
- Update location contracts and operating guidance to reflect the new source.
  ADR-0009 describes the replacement direction; supersede ADR-0008 when adopting
  the implementation, preserving its independent UI and booking-safety decisions.
- Preserve existing checkout changes. Do not revert the broad baseline commit,
  which also contains unrelated delivery and seller-interface work.

## Testing Decisions

- Prefer externally observable behavior over private helper structure. The primary
  existing seam is the public-order HTTP API with controlled provider transport,
  covering both hierarchy lookup and buyer submission. No new public test seam
  or production-only testing endpoint is needed.
- Use the existing rendered buyer-form seam only for UI behavior HTTP tests cannot
  demonstrate. These seams are synthesized from repository prior art; no separate
  test-seam confirmation was obtained during the no-interview specification step.
- Extend existing buyer location, location-requirement and public-link lifecycle
  API scenarios. Prove cities load without a snapshot and only the selected
  branch is fetched; assert absence of unrelated provider requests.
- At controlled provider transport, cover valid-token reuse, bounded list reuse,
  concurrent identical requests, expiry, error recovery and cooldown behavior.
  Assert request counts and outcomes, not cache dictionary layout or helper names.
  Reuse existing transport/authentication fixtures and catalogue-session test art.
- Exercise auth and location-endpoint rate limits separately, timeout, malformed
  responses and empty lists. Use controlled time rather than real sleeps or live
  rate-limit reproduction; verify retries become possible after cooldown.
- Cover cross-shop/environment isolation, disconnect/reconnect, connection changes
  during I/O, cache hits after link expiry/revocation, and invalid parent queries.
  Provider work must not bypass existing public gates or hold database transactions.
- Cover required choices, forged IDs, mismatched parents, empty cities/zones,
  no-area zones, unsupported destinations and unavailable fallback at submission.
  Verify server-derived labels, discarded unverified IDs and preserved payment data.
- Cover accepted replay without fresh provider work, legacy optional version
  compatibility and simultaneous connection changes during submission resolution.
- Extend rendered dropdown, pending-lookup, location-requirement and locale tests
  for parent usability, descendant resets, late responses, retained details,
  retries, language switching, loading guards and localized fallback guidance.
- Verify seller settings retain connection controls but omit catalogue refresh
  and status controls. Verify connection and job entry points do not crawl the
  hierarchy. Retain seller-review tests proving fallback cannot authorize booking.
- Run focused backend/frontend tests per bounded behavior cluster, then root
  `npm run check` as the final implementation gate. Record actual fresh results.
- Perform browser acceptance for selection, rapid parent changes and outage
  fallback. Report browser, PostgreSQL, hosted scheduling and live-provider checks
  separately; mocks and HTTP smoke do not prove those environments.
- Do not automatically probe live Pathao or make booking requests to reproduce
  rate limits. Any later live validation is a separately reported manual check.

## Out of Scope

- Restoring the old dropdown appearance or reintroducing location search inputs.
- Obtaining a buyer's written address from Pathao, GPS, geocoding or address AI.
- Automatic booking or weakening seller review, payment review or buyer-link rules.
- Dropping snapshot tables, deleting historical buyer submissions or rolling back
  unrelated baseline changes.
- A complete crawler with a slower schedule, partial-snapshot publishing or a
  second database-backed catalogue fallback.
- New shared cache infrastructure, distributed rate-limit coordination or a
  guarantee that Pathao can never rate-limit ordinary requests.
- Changing the merchant environment-selection policy or sharing credentials.
- Deployment, product-launch readiness, live bookings or inferred provider quotas.

## Further Notes

The owner accepted on-demand backend fetching with current presentation retained,
token/list/request reuse and cooldown handling, written-address fallback requiring
seller resolution, and retirement of full synchronization without table removal.
This specification publishes that agreed scope; implementation has not begun.

The proposed replacement is recorded in [ADR-0009](../../docs/adr/0009-on-demand-buyer-pathao-locations.md).
Historical investigation and pending checkout fixes remain in the
[existing catalogue task](../../tasks/pathao-buyer-catalog.md). That task's prior
test results do not verify this specification's future implementation.
