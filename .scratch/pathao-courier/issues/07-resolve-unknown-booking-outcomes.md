# 07: Resolve unknown booking outcomes

**What to build:** A seller can safely reconcile an uncertain submission by associating the existing Pathao booking or recording confirmed noncreation before retrying, with an attributable and durable resolution history.

**Blocked by:** 06 — Submit drafts safely through the offline courier adapter.

**Status:** implemented — local verification complete

## Implementation record (2026-10-27)

- Added migration 0025: `resolution_version`, `resolution_action`, and `resolved_at`
  on `courier_attempts`, plus append-only `courier_reconciliations` audit rows
  (actor, action, version, resulting state, environment, consignment/order
  references, safe evidence, timestamp) with attempt/version and consignment
  uniqueness.
- Added seller-only `POST /api/seller/orders/{id}/courier-reconciliation`. Requires
  `Idempotency-Key`, `attempt_id`, `expected_version`, and an explicit action.
  `attach_existing` additionally requires environment, consignment, and merchant
  order reference. `confirm_noncreation` requires explicit acknowledgement and no
  consignment evidence.
- The offline adapter (`pathao_provider.lookup_booking`) verifies the consignment
  against shop digest, order reference, store, and environment. Later sandbox
  transport replaces this same function; no second resolution path exists.
- Attach preserves the original attempt, reviewed token, correlation ID, and booking
  snapshot and records `success`. The audit row retains the prior unknown error code.
  Confirmed noncreation records `failed`/`CONFIRMED_NONCREATION` and permits a normal
  reservation retry, which revalidates lifecycle, review token, connection revision,
  address, and parcel data. The seller UI requires an explicit confirmation checkbox
  before this action.
- Conflicts: stale version `409 STALE_VERSION`, already resolved
  `409 ATTEMPT_NOT_RECONCILABLE`, unverifiable evidence `422 EVIDENCE_UNAVAILABLE`,
  mismatched evidence `422 EVIDENCE_MISMATCH`, duplicate consignment
  `409 CONSIGNMENT_ALREADY_ASSOCIATED`. Provider evidence lookup runs outside the
  database transaction; final application runs under shop/order/attempt locks.
- Seller `CourierReconciliation` UI requires checking Pathao, offers attach and
  acknowledged noncreation actions, suppresses duplicate clicks, ignores late
  session responses, and shows recovered/noncreation state without a reset-to-ready
  control.
- Contracts: `docs/pathao-submission-contract.md`, `docs/API_CONTRACTS.md`.

## Verification (2026-10-27)

- Focused backend reconciliation suite (memory + real disposable loopback
  PostgreSQL): 14 passed. Full focused courier suite: 76 passed.
- Reconnect/settings rotation, draft edits, stale versions, cross-shop visibility,
  foreign-shop consignments, duplicate association, replay, competing resolutions,
  cancellation, and restart (PostgreSQL) are covered.
- Root `npm run check`: **PASS** across all eight gates, result
  `.cache/checks/check-B9Xx3w/result.json`. Backend 613 passed, 0 skipped against
  loopback PostgreSQL on port 5432; frontend 189 passed; build and HTTP smoke passed.
- Simulated offline evidence only. Real Pathao/Clerk, sandbox consignment lookup,
  hosted migrations, browser, and physical-device acceptance: NOT RUN.

- [x] Provide authenticated, versioned, idempotent reconciliation operations and seller UI for unknown attempts. Preserve the original attempt and its reviewed snapshot rather than replacing uncertainty with an untracked new submission.
- [x] Allow an existing consignment to be attached only with the available account, order/reference, and environment evidence required to establish the correct association. Reject another shop's or environment's consignment and prohibit associating one consignment with multiple orders.
- [x] Record the seller actor, action, timestamp, safe reference/evidence details, and resulting state without logging merchant secrets or duplicating raw provider payloads.
- [x] A retry becomes available only after recorded confirmation that creation failed; an immediately empty merchant panel, a timeout, or absence from a local list is not sufficient proof.
- [x] If necessary evidence cannot be validated, leave the attempt protected and explain the remaining action. Do not introduce an unrestricted reset-to-ready control.
- [x] After a valid noncreation resolution, revalidate current order lifecycle, review revision, connection, address, and parcel data before permitting a new attempt. Cancellation still prevents a new booking; association of a recovered existing booking must preserve required external-action warnings.
- [x] Resolve concurrent/repeated reconciliation safely. Changing settings, reconnecting an account, editing the draft, or using another idempotency key cannot bypass the unknown state.
- [x] Implement verification through the existing courier adapter and offline fixtures; later sandbox wiring must replace this same boundary rather than inventing a second resolution path.
- [x] Verify API/PostgreSQL and seller component behavior for recovered success, confirmed noncreation, rejected/missing evidence, wrong ownership/environment, duplicate association, replay, competing resolutions, restart, stale review, and cancellation.
- [x] Run focused tests and root `npm run check` as the final gate. Label simulated evidence honestly; actual provider verification remains a separate sandbox acceptance step.
