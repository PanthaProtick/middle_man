# 03: Retire full-catalogue synchronization and seller controls

**What to build:** Sellers manage their Pathao connection without obsolete
catalogue refresh/status controls, and neither connection events nor scheduled
execution start complete location crawls. Buyer location selection continues
working on demand without destructive database changes.

**Blocked by:** 01 — Restore on-demand buyer location selection and submission.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Connecting, reconnecting or replacing a Pathao connection does not start a
  full city/zone/area crawl; eligible buyers can instead load individual lists
  through the on-demand path without waiting for synchronization.
- [ ] Scheduled workers, command wrappers, manual refresh endpoints and other
  executable entry points no longer start complete hierarchy crawls. Retire the
  obsolete sync execution path rather than hiding only its seller button.
- [ ] Seller settings no longer offer catalogue refresh or show catalogue age,
  synchronization progress or refresh failures. Preserve connection/disconnection,
  environment selection, pickup settings and relevant connection health feedback.
- [ ] Remove obsolete UI copy and callers only where supported by the source
  change; preserve unrelated seller metrics, delivery staging and checkout work.
- [ ] Existing snapshot tables, migrations and historical submission data remain
  intact. No destructive migration or blanket deletion of stored records is used.
- [ ] Update operations, setup and scheduling guidance so new deployments do not
  install the old crawler. Identify any already-hosted schedule needing removal
  and report whether it was verified or remains unrun; local source removal alone
  must not be described as proof of a hosted configuration change.
- [ ] Existing connection/API/job-entry tests verify absence of crawl traffic.
  Rendered seller-settings tests verify removal of obsolete controls and retention
  of usable account settings; the buyer API/form happy path remains passing.
- [ ] Remove unused runtime sync code only after tracing its callers. Reconcile
  affected prior tests with the retired behavior without weakening location,
  connection, seller-review or booking-safety assertions.
- [ ] Run focused tests for connection/settings/job changes, followed by root
  `npm run check`. Record fresh results and separately report browser and hosted
  scheduling checks as passed, failed, blocked or unrun.

## Dependency note

Ticket 02 is not a blocker: once ticket 01 supplies the working on-demand path,
retiring synchronization and seller controls does not depend on further request
coalescing or cooldown work. The full feature still requires both tickets.

## References

- [Feature specification](../spec.md)
- [Blocking ticket 01](01-restore-on-demand-selection-and-submission.md)
