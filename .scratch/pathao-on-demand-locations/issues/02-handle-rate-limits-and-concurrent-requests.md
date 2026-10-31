# 02: Keep buyer submissions usable during rate limits and concurrent requests

**What to build:** Simultaneous buyers share identical location requests, provider
rate limits do not trigger retry storms, and buyers retain their details and can
use written-address fallback when choices are unavailable. Lookups recover when
the provider becomes available again.

**Blocked by:** 01 — Restore on-demand buyer location selection and submission.

**Status:** verification found gaps (see follow-up below)

## Acceptance criteria

- [x] Concurrent requests for the same list in the same shop, environment and
  connection revision share provider work. Different parents or authority scopes
  remain isolated. Concurrent cache misses do not cause token issuance storms.
- [x] Shared request failure or cancellation cannot leave permanent pending
  entries or stranded buyers. A subsequent eligible request can recover.
- [x] Both authentication and location-endpoint rate limits respect valid provider
  retry guidance. Missing/invalid guidance uses bounded backoff; neither server
  nor buyer retry controls create immediate retry loops.
- [x] Cooldown state remains limited to the affected provider authority scope;
  one shop or environment cannot block another. Provider errors are not cached
  as successful empty lists or converted into resolved destinations.
- [x] Eligible requests may use a still-valid cached list during provider problems;
  expired entries do not silently acquire an indefinite stale lifetime.
- [x] During established unavailability, buyers see localized guidance and retain
  their name, contact number, written address, selections where still appropriate
  and payment claim. Retry preserves unrelated details and stale responses cannot
  overwrite a newer selection or connection.
- [x] Buyers can submit written-address fallback during established unavailability.
  The server discards unverified location metadata, preserves the payment claim,
  and requires seller resolution before booking. An in-flight lookup does not
  bypass available-choice validation.
- [x] Once cooldown expires and provider requests succeed, buyers can retry and
  complete selection without restarting the form. Accepted submission replays
  remain independent of provider recovery and new catalogue work.
- [x] Controlled provider-transport tests cover simultaneous identical requests,
  token/list expiry, auth and list HTTP 429 responses, timeout, malformed responses,
  cancellation/failure cleanup and successful recovery. Assert externally visible
  outcomes and provider call counts, using controlled time rather than real sleeps.
- [x] Existing API and rendered buyer-form seams verify fallback submission,
  retained details, localized guidance and recovery end to end. Retain fresh
  seller-review tests demonstrating that fallback cannot authorize booking.
- [x] Keep token/list/in-flight/cooldown storage bounded and connection-aware.
  Document process-local coordination limits without claiming deployment-wide
  rate-limit protection or adding shared cache infrastructure.
- [x] Run focused tests and final root `npm run check`; record fresh results and
  browser acceptance status. Do not reproduce throttling through live requests
  or make booking calls as part of automated verification.

## References

- [Feature specification](../spec.md)
- [Blocking ticket 01](01-restore-on-demand-selection-and-submission.md)

## Implementation record (2026-10-31)

Implemented the on-demand prerequisite from ticket 01 together with this ticket.

- Buyer browsing and submission now use `pathao_catalog.hierarchy`/`choices`
  instead of persisted snapshots. Legacy `catalog_version` payloads are accepted
  and ignored. Snapshot tables, migrations and historical rows remain intact.
- Connecting a Pathao account no longer starts a full hierarchy crawl. Manual
  refresh/status endpoints and the scheduled worker remain for ticket 03 to retire.
- Added process-local token reuse, list caching, in-flight coalescing and
  auth/location cooldowns in `pathao_catalog` and `pathao_location_access`.
  Cooldowns are scoped by shop, environment and connection revision. Valid
  `Retry-After` guidance is capped at one hour; missing/invalid guidance uses
  bounded exponential backoff from five seconds.
- Buyer submission reuses a still-valid list; seller review requests fresh provider
  facts. Provider failures never become successful empty catalogues.
- Added controlled transport tests for concurrent requests, token/list expiry,
  auth/list 429 responses with and without guidance, timeouts, malformed
  responses, cancellation/failure cleanup, isolation, recovery and bounded stores.
- Added rendered buyer-form coverage for retained details, localized guidance and
  retry recovery. Existing fallback and seller-review tests remain passing.
- Updated the location contract, retained catalogue operations guidance and ADR
  adoption/supersession records.

Verification:

- `npm run check`: PASS (tooling, conventions, backend/frontend lint and types,
  backend 640 passed / 177 skipped, frontend 505 passed, build, HTTP smoke).
- Fresh result: `.cache/checks/check-rs5ODr/result.json`.
- Focused backend pathao/courier set: 91 passed.
- Browser acceptance: unrun. PostgreSQL tests: skipped (no disposable loopback
  target configured). Live Pathao and booking calls: not performed.
- Changed paths: `backend/app/services/pathao_catalog.py`,
  `backend/app/services/pathao_location_access.py`,
  `backend/app/services/pathao_locations.py`,
  `backend/app/services/pathao_provider.py`, `backend/app/api/public_orders.py`,
  `backend/app/api/pathao.py`, `backend/app/services/pathao_snapshot_sync.py`,
  affected pathao tests, buyer-form test, location/catalogue/ADR docs and tickets.
- Remaining risks: coordination is process-local only; retained scheduled/manual
  crawls still exist until ticket 03; browser, PostgreSQL, hosted scheduling and
  live-provider behavior remain unverified.
- Next action: implement ticket 03 to retire crawl entry points and seller
  refresh/status controls without dropping snapshot tables.

## Independent verification (2026-10-31)

Reviewed implementation at `b04cf62` with a clean initial checkout. No production
code was changed during verification. Three acceptance gaps were reproduced with
controlled time and synthetic transport/work in `.cache/verify_pathao_02.py`:

- A successful list request started before another request's HTTP 429 removes
  that newer scope cooldown. Reproducer observed 60 seconds remaining immediately
  after the 429, then zero after the earlier request succeeded. Preserve newer
  cooldowns when recording success from already-running requests.
- Both auth and list cooldown expiry delete the failure counter. Consecutive
  unguided 429s therefore each wait five seconds instead of the documented
  exponential backoff. Preserve failure history until successful recovery.
- Distinct misses create tasks and pending-map entries before semaphore admission.
  The reproducer retained 200 pending entries with only four admitted requests;
  there is no pending-entry cap. Token locks also cannot be trimmed past a locked
  oldest entry. Bound admission/storage without breaking identical-request sharing.

Fresh checks:

- Focused backend: 54 passed; focused rendered buyer UI: 26 passed.
- Initial root check: 639 passed, 177 skipped, one pytest temporary-directory
  permission error; result `.cache/checks/check-P8vsW3/result.json`.
- Root `npm run check` with repository-local `PYTEST_ADDOPTS=--basetemp=...`:
  PASS; result `.cache/checks/check-QuFw9C/result.json`.
- Browser, PostgreSQL, hosted and live-provider acceptance: unrun. No live
  throttling probes or booking calls were made.

Next action: fix the three coordination gaps and add regression cases for
overlapping success/429, repeated 429 windows and concurrent storage pressure.
Passing existing tests does not close those reproduced acceptance gaps.
