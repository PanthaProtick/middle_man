# 07: Organize courier workflows

**Status:** ready-for-agent

**What to build:** Cohesive courier draft, review, submission, reconciliation, and settings workflows whose organization preserves seller control and duplicate-booking protections.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [ ] Use inventory-bounded targets and trace UI, endpoints, services, adapters, fixtures, and tests for each courier responsibility before modifying it.
- [ ] Organize existing modules and colocated tests by owned behavior, decomposing oversized responsibilities without changing external interfaces or schema.
- [ ] Preserve one local draft per confirmation, seller review, parcel/location validation, server-derived remaining COD balance, and independent order-confirmation success.
- [ ] Preserve stale-draft/account revision protection, replay behavior, uncertain-outcome blockers, reconciliation, privacy, and retention guarantees.
- [ ] Preserve localization, entered/provider data, focus/input recovery, and protection against repeated courier actions.
- [ ] Preserve meaningful adapter, API, rendered, replay, failure, and PostgreSQL coverage; verify discovery and fixtures after moves and document narrow size exceptions.
- [ ] Verify each bounded responsibility before proceeding; no live bookings or provider mutations are authorized as cleanup verification.
- [ ] Run final root `npm run check` and record dispositions, exceptions, actual integration results, and unrun hosted/device/live-provider gates.

