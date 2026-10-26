# 07: Resolve unknown booking outcomes

**What to build:** A seller can safely reconcile an uncertain submission by associating the existing Pathao booking or recording confirmed noncreation before retrying, with an attributable and durable resolution history.

**Blocked by:** 06 — Submit drafts safely through the offline courier adapter.

**Status:** ready-for-agent

- [ ] Provide authenticated, versioned, idempotent reconciliation operations and seller UI for unknown attempts. Preserve the original attempt and its reviewed snapshot rather than replacing uncertainty with an untracked new submission.
- [ ] Allow an existing consignment to be attached only with the available account, order/reference, and environment evidence required to establish the correct association. Reject another shop's or environment's consignment and prohibit associating one consignment with multiple orders.
- [ ] Record the seller actor, action, timestamp, safe reference/evidence details, and resulting state without logging merchant secrets or duplicating raw provider payloads.
- [ ] A retry becomes available only after recorded confirmation that creation failed; an immediately empty merchant panel, a timeout, or absence from a local list is not sufficient proof.
- [ ] If necessary evidence cannot be validated, leave the attempt protected and explain the remaining action. Do not introduce an unrestricted reset-to-ready control.
- [ ] After a valid noncreation resolution, revalidate current order lifecycle, review revision, connection, address, and parcel data before permitting a new attempt. Cancellation still prevents a new booking; association of a recovered existing booking must preserve required external-action warnings.
- [ ] Resolve concurrent/repeated reconciliation safely. Changing settings, reconnecting an account, editing the draft, or using another idempotency key cannot bypass the unknown state.
- [ ] Implement verification through the existing courier adapter and offline fixtures; later sandbox wiring must replace this same boundary rather than inventing a second resolution path.
- [ ] Verify API/PostgreSQL and seller component behavior for recovered success, confirmed noncreation, rejected/missing evidence, wrong ownership/environment, duplicate association, replay, competing resolutions, restart, stale review, and cancellation.
- [ ] Run focused tests and root `npm run check` as the final gate. Label simulated evidence honestly; actual provider verification remains a separate sandbox acceptance step.
