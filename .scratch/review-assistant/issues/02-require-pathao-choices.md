# 02: Require available Pathao destination choices

**What to build:** Buyers select valid Pathao city, zone, and area choices when
available and write their street/house/landmark address themselves. Catalog failures
or unsupported coverage preserve the submission for explicit seller resolution.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Implementation difficulty:** 4/5 — High.

**Why:** Mandatory selections must coexist with empty catalogs, outages, changing
connections, parent/child validation, and submission replay. A blanket required
validator would block valid fallback submissions or break already accepted retries.

**Agent fit:** Strong asynchronous form and API validation experience; comfortable
with provider-authority and idempotency boundaries.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [ ] Require supported city/zone/area selections wherever those catalog choices
  exist. Show useful Bengali/English guidance and focus invalid fields; keep manual
  street/house/landmark entry available and required as appropriate.
- [ ] Reset dependent choices on parent changes and reject known invalid hierarchy
  membership server-side, regardless of client-supplied labels or resolved flags.
- [ ] Distinguish loading from established unavailability. Do not silently treat
  an in-flight catalog request as permission to bypass required available choices.
- [ ] Preserve written address and payment claim through disconnected/unavailable
  catalogs, unsupported coverage, empty city/zone lists, and no-area zones, with
  explicit seller-resolution state and no fabricated IDs or support claims.
- [ ] A selected unsupported area or explicit coverage problem cannot authorize
  courier submission. Keep existing courier readiness and booking safeguards.
- [ ] Server-derived location authority remains authoritative; frontend checks
  improve usability without trusting client assertions about provider conditions.
- [ ] Preserve submission idempotency: accepted replays do not need fresh catalog
  work or lose prior results when provider availability changes.
- [ ] HTTP tests cover complete/missing choices, forged IDs, empty lists, outage,
  unsupported/no-area cases, changing connection/catalog authority, and replay.
- [ ] Rendered tests cover required feedback, parent resets, loading/unavailable
  transitions, bilingual copy, and preservation of written/payment drafts.
- [ ] Run focused location/submission tests and final root `npm run check`; use
  existing offline catalogs/intercepted transports, never live Pathao or Gemini.

## Notes

This can land before or after address AI retirement. Coordinate shared buyer-form
edits without inventing a semantic dependency. It does not establish live booking
readiness or remove any existing booking-disable policy.
