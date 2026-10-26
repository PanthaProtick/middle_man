# 04: Collect Pathao delivery locations from buyers

**What to build:** Buyers select searchable Pathao city, zone, and applicable area choices and enter a detailed address. A courier lookup outage or unsupported destination does not prevent recording their address and payment claim, but leaves booking blocked for seller resolution.

**Blocked by:** 03 — Connect a seller's Pathao account.

**Status:** ready-for-agent

- [ ] Extend the buyer submission form, typed API contracts, persisted address metadata, and seller-visible address details with Pathao location identifiers and labels alongside the detailed written address. Do not equate provider IDs with existing district/thana text fields.
- [ ] Provide dependent searchable selectors, clear incompatible child choices when a parent changes, and validate parent-child membership on the backend. Handle zones without areas according to the verified provider contract rather than requiring a nonexistent selection.
- [ ] Keep house/street details and useful delivery directions available. Preserve the distinction between buyer contact and payment sender numbers.
- [ ] Expose a controlled server-side location-catalog interface with bounded caching and the existing buyer-link/public-admission policy. Never expose merchant credentials, private settings, or arbitrary provider-request capabilities.
- [ ] Buyers can submit a written address and payment claim if catalogs cannot load, including when the seller has not connected Pathao and no catalog is available. Persist an explicit unresolved-location condition and preserve entered data during retries.
- [ ] For unsupported service locations, retain the address and payment claim, expose a clear seller-action condition, and prohibit booking. Never guess IDs, pick the first returned option, or substitute a nearby location.
- [ ] Distinguish provider unavailability, missing choices, unsupported coverage, and forged or inconsistent identifiers. A fallback submission must not silently validate arbitrary client-supplied location IDs.
- [ ] The seller can inspect the submitted address/location condition through existing private order views; no new buyer sign-in or buyer authority is introduced.
- [ ] Respect retention/redaction for new address data. Catalog responses must not disclose another shop's secrets or buyer information, and revoked/invalid links retain their existing access-denial behavior.
- [ ] Verify through API/PostgreSQL and buyer component tests: dependent reset, invalid relationships, no-area zones, cached choices, outage and disconnected fallback, unsupported coverage, preserved payment claim, input recovery, privacy, and accessible loading/errors.
- [ ] Run focused tests and root `npm run check` as the final gate. Record simulated versus actual catalog evidence separately; this ticket does not enable booking.
