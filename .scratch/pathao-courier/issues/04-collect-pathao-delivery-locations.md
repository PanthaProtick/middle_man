# 04: Collect Pathao delivery locations from buyers

**What to build:** Buyers select searchable Pathao city, zone, and applicable area choices and enter a detailed address. A courier lookup outage or unsupported destination does not prevent recording their address and payment claim, but leaves booking blocked for seller resolution.

**Blocked by:** 03 — Connect a seller's Pathao account.

**Status:** completed (local verification; live-provider acceptance unrun)

- [x] Extend the buyer submission form, typed API contracts, persisted address metadata, and seller-visible address details with Pathao location identifiers and labels alongside the detailed written address. Do not equate provider IDs with existing district/thana text fields.
- [x] Provide dependent searchable selectors, clear incompatible child choices when a parent changes, and validate parent-child membership on the backend. Handle zones without areas according to the verified provider contract rather than requiring a nonexistent selection.
- [x] Keep house/street details and useful delivery directions available. Preserve the distinction between buyer contact and payment sender numbers.
- [x] Expose a controlled server-side location-catalog interface with bounded caching and the existing buyer-link/public-admission policy. Never expose merchant credentials, private settings, or arbitrary provider-request capabilities.
- [x] Buyers can submit a written address and payment claim if catalogs cannot load, including when the seller has not connected Pathao and no catalog is available. Persist an explicit unresolved-location condition and preserve entered data during retries.
- [x] For unsupported service locations, retain the address and payment claim, expose a clear seller-action condition, and prohibit booking. Never guess IDs, pick the first returned option, or substitute a nearby location.
- [x] Distinguish provider unavailability, missing choices, unsupported coverage, and forged or inconsistent identifiers. A fallback submission must not silently validate arbitrary client-supplied location IDs.
- [x] The seller can inspect the submitted address/location condition through existing private order views; no new buyer sign-in or buyer authority is introduced.
- [x] Respect retention/redaction for new address data. Catalog responses must not disclose another shop's secrets or buyer information, and revoked/invalid links retain their existing access-denial behavior.
- [x] Verify through API/PostgreSQL and buyer component tests: dependent reset, invalid relationships, no-area zones, cached choices, outage and disconnected fallback, unsupported coverage, preserved payment claim, input recovery, privacy, and accessible loading/errors.
- [x] Run focused tests and root `npm run check` as the final gate. Record simulated versus actual catalog evidence separately; this ticket does not enable booking.

## Implementation record — 2026-10-26

- Review baseline: `b2061b63970e30d269b88ce82309dac6451654e6`, current branch unchanged.
- User confirmed TDD seams: HTTP API/PostgreSQL, buyer components and simulated provider transport.
  Observed failing-to-passing cycles for disconnected fallback, hierarchy/coverage, component recovery,
  and expired/invalid-query catalog denial.
- New typed public catalog and revision metadata: models/services `pathao_location`, `pathao_catalog`,
  `pathao_locations`; migration `0022_pathao_locations.sql`; existing buyer submission/revision/history
  integration. Frontend `PathaoLocations`, buyer draft/payload types, seller history condition/labels.
- Design: server-selected environment; no cross-shop credential reuse; bounded tenant/revision cache
  (128 entries, five minutes), bounded upstream lists/body/concurrency/timeouts. No provider transaction
  overlaps submission locks; original payload retry identity and current link authority are preserved.
- Written-address fallback discards unverified IDs rather than validating them; known invalid membership
  is rejected. Unsupported and empty-area states remain seller-action conditions. All booking remains
  blocked. No-area booking omission is not established by the reviewed SDK, so empty area lists are
  explicitly `no_area_unverified`, never an impossible required choice or guessed area.
- Seller address corrections invalidate location authority; other corrections preserve it. Metadata is
  erased with the buyer revision, and replay redaction follows the existing retention boundary.
- Source/contract evidence and limits: `docs/pathao-location-contract.md`. Actual SDK location/models/order
  sources reviewed via connected GitHub. No live catalog or merchant/provider request was made.
- Focused API: 8 passed. Existing buyer API/correction/link regressions: 40 passed before the added
  expiry case. Buyer selector: 1 passed; buyer retry: 8 passed; prior buyer/seller regression selection:
  19 passed. Typecheck passed. Initial lint found import ordering and effect state updates; corrected.
- Disposable PostgreSQL 18 on loopback port 55434: 21 passed (4 new location scenarios plus 17 existing
  transaction/expiry cases). Fresh sessions, tenant denial, sensitive-row erasure and replay denial
  verified. Existing port 55432 was unavailable; a new isolated cache cluster was initialized instead.
  Standalone backend checks require `SELF_TEST_MODE=false` because local configuration otherwise enables
  durable integration mode. No actual environment/credential file was read or changed.
- Browser: actual selector component with synthetic HTTP fixtures; observed loading, dependent choices,
  child resets, outage/retry, retained IDs and address, and empty-area fallback. Screenshot:
  `.cache/pathao-locations-browser.png`. Temporary frontend harness removed. This is component browser
  evidence, not a hosted/live Clerk or provider journey; physical-device checks are unrun.
- Next: independent standards/spec review, resolve findings, run final root `npm run check` with disposable
  PostgreSQL enabled, record results and commit to the current branch.

## Standards review

- Initial documented-standard finding: new address-correction behavior lacked regression tests.
  Added HTTP tests showing name/payment changes retain resolved metadata and address changes clear
  authority even if the request asserts forged `resolved`/unblocked fields.
- Initial judgment call: duplicated hierarchy traversal. Shared `pathao_catalog.hierarchy` now owns
  parent validation for both catalog reads and submission validation, with a total hierarchy deadline.
- Independent follow-up review of the final staged correction: **0 remaining Standards findings**.

## Spec review

- Initial P2: expired/already-submitted fresh requests could do catalog I/O before final rejection.
  Added transport-count regressions (observed red: two calls; green: zero calls). Saved replay remains
  available without revalidating catalogs, while revocation/retention still deny it.
- The first correction used a short extra order lock. Real PostgreSQL reproduced two existing
  expiry-read races: releasing that preflight lock allowed a deadline read to precede the submission's
  final lock. Replaced preflight with a read-only window snapshot: closed windows skip provider work
  and reach the existing locked rejection. The original aggregate write transaction remains intact.
- Focused final location API plus real PostgreSQL boundary regressions: **21 passed** (11 + 10).
  Independent follow-up review: **0 remaining Spec findings**.

## Full gate record

- First root gate `.cache/checks/check-Z33sQi/result.json`: backend **555 passed**; frontend **174 passed,
  1 failed**, because an existing sequence-only mock assigned the new catalog GET the submission's
  promise. Added an explicit disconnected catalog response without weakening its late-response/public
  policy assertions; focused `BuyerRefresh.test.tsx` then **13 passed**.
- Superseded `.cache/checks/check-EBo27V/result.json` run was interrupted when the focused PostgreSQL
  race regression above was discovered; it is not completion evidence.
- Final root `npm run check`: **PASS**, `.cache/checks/check-cO1fYn/result.json`.
  Tooling, backend/frontend lint, strict types, **558 backend tests** (disposable PostgreSQL enabled),
  **175 frontend tests**, production build and HTTP smoke all passed. No live/hosted migration or real
  courier booking is part of these checks. Standards: 0 remaining findings; Spec: 0 remaining findings.
- Final action: commit this reviewed implementation on the current branch; the repository pre-commit
  hook runs the full gate again. Booking and live-provider acceptance remain later tickets.
