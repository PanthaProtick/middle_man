# 01: Restore on-demand buyer location selection and submission

**What to build:** Buyers load cities, then only the selected city's zones and
selected zone's areas through our backend, and submit their destination without
depending on a saved Pathao location catalogue. Keep the current form experience
and existing submission safeguards.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A connected shop with no saved catalogue can load cities, select a city,
  zone and area, and submit a destination with server-derived labels.
- [ ] Browsing and submission resolution both use on-demand provider lists;
  neither requires a snapshot, complete hierarchy crawl or snapshot lease.
- [ ] Only requested branches and necessary parent membership lists are fetched.
  Tests assert that unrelated cities' zones and unrelated zones' areas are not
  requested, including during submission validation.
- [ ] Valid provider tokens are reused according to expiry. Requested lists retain
  bounded five-minute caching, scoped by shop, environment, connection revision,
  hierarchy level and parent; credentials and tokens remain server-side.
- [ ] The current dropdown presentation, parent usability, descendant-only resets,
  form-level remembered lists and stale-response protection remain intact.
- [ ] Language switching preserves selections and entered details without extra
  location requests; relevant guidance remains available in Bengali and English.
- [ ] Available choices remain required with accessible field errors. Known forged
  IDs and invalid parent relationships are rejected; client labels, conditions,
  resolved flags and unsupported claims cannot bypass server-derived validation.
- [ ] Existing fallback behavior survives unavailable/disconnected providers, empty
  cities/zones, no-area zones and explicit unsupported destinations. Written
  address and payment claim survive; unverified IDs/labels are discarded rather
  than invented. In-flight loading is not treated as established unavailability.
- [ ] Fallback destinations remain blocked for booking until seller resolution;
  seller courier review continues checking current provider facts independently
  of buyer caches and never treats a selected location as booking authority.
- [ ] Existing public gates, quotas, buyer-link expiry/revocation, privacy and
  retention rules apply before cache hits and provider requests. Cross-shop and
  cross-environment cache reuse is impossible.
- [ ] Disconnecting or replacing a connection revokes old authority, including
  in-flight results. Recheck connection revision before accepting location facts
  or returning required/invalid-choice errors from an obsolete connection.
- [ ] Already-open forms carrying the old optional catalogue version can submit
  safely without requiring that snapshot or trusting its stale authority. Preserve
  original-payload retry identity, including legacy fields.
- [ ] Accepted submission replays return the prior result without new provider
  work, while retaining the existing current buyer-link authority checks.
- [ ] Update the affected source/version contracts and record adoption of the
  replacement ADR without discarding historical decisions. Preserve unrelated
  checkout changes and existing snapshot tables. Do not revert the broad baseline.
- [ ] Extend existing public-order/location API tests with controlled provider
  transport and rendered buyer-form tests. Verify the complete happy path,
  validation/fallback, legacy compatibility and connection-change behavior without
  live credentials; preserve deterministic offline fixtures.
- [ ] Run focused backend/frontend checks per behavior cluster and root
  `npm run check` as the final gate. Record fresh results and separately report
  browser, live-provider and PostgreSQL checks as passed, failed, blocked or unrun.

## Scope boundary

This ticket establishes the working on-demand path and preserves existing error
semantics. Ticket 02 adds concurrent-request coalescing, explicit cooldown policy
and broader failure/recovery coverage. Ticket 03 retires obsolete full-crawl
execution and seller controls. All three are required to complete the feature;
ticket 01 alone does not establish resolution of the overall rate-limit problem.

## References

- [Feature specification](../spec.md)
- [Replacement architecture decision](../../../docs/adr/0009-on-demand-buyer-pathao-locations.md)
