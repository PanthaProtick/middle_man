# 07: Resolve unknown booking outcomes

**What to build:** A seller can safely reconcile an uncertain submission by associating the existing Pathao booking or recording confirmed noncreation before retrying, with an attributable and durable resolution history.

**Blocked by:** 06 — Submit drafts safely through the offline courier adapter.

**Status:** implemented — completion gaps resolved; local verification complete

## Browser verification follow-up (2026-10-27)

- **PASS**: exercised the actual seller review/reconciliation components and
  stylesheet in a real browser with explicitly synthetic fetch responses.
  Verified initial protections, rejected evidence, response interruption and
  retained retry key, disabled loading controls, recovered success,
  cancelled-order external-action warning, and acknowledged noncreation.
- Evidence and reproduction fixture:
  [browser verification record](../ticket07-browser-verification.md), including
  screenshots of cancelled-order recovered success and confirmed noncreation.
- This closes the changed-component browser interaction check. It does not
  establish an authenticated whole-app or live-provider journey. Physical-device,
  sandbox/live Pathao/Clerk, and hosted migration acceptance remain NOT RUN.
- No production source changes in this verification pass; the prior full
  `check-6eNPhc` automated PASS remains applicable.

## Completion fixes (2026-10-27)

- Closed the replay failure window: resolution, append-only audit, and a durable
  idempotency receipt now commit in one transaction. Review rendering happens
  after commit and outside resolution locks. A failed render/finalization resumes
  from the receipt; the first persisted response remains the stable replay.
- Same-key checks run again after loading the attempt and after acquiring locks.
  Duplicate-consignment validation runs under those locks after replay handling,
  so delayed evidence cannot mistake a winning same-key resolution for a duplicate.
- Seller reconciliation retains the key for retries with the same payload.
  Recovered bookings on orders that are no longer confirmed explicitly warn that
  local cancellation does not cancel Pathao and require seller action in Pathao.
- Changed paths: `backend/app/core/idempotency.py`, reconciliation service and new
  `courier_reconciliation_replay.py` / `courier_reconciliation_resolution.py`,
  reconciliation backend tests and new memory/PostgreSQL replay suites,
  `CourierReconciliation.tsx`, `CourierReview.tsx`, component tests, and contracts.
  No new migration or live-provider transport is needed.
- Regression coverage: both actions across receipt/write/render/finalization
  failures, PostgreSQL rollback after a flushed receipt, simultaneous same-key
  identical/different input, delayed evidence, stable replay after a later booking,
  retained UI retry keys, and cancelled-order recovered success warnings.
- Focused checks: 30 reconciliation backend tests passed before the final delayed
  evidence case; the updated PostgreSQL replay suite then passed 11/11.
  Seller component suite: 7/7 passed. Backend lint and strict types passed.
- Final root `npm run check`: **PASS**, all eight gates; **630 backend passed,
  0 skipped**, **191 frontend passed**, build and HTTP smoke passed. Result:
  `.cache/checks/check-6eNPhc/result.json`. Tests used disposable isolated schemas
  on loopback PostgreSQL port 5432 and workspace-local TEMP/TMP.
  At that gate, browser/device and live Pathao/Clerk, sandbox lookup,
  and hosted migrations remain NOT RUN. Ticket 08 still owns the broader
  post-submission correction/mismatch workflow.
- Local ticket 07 scope is complete. Next action: ticket 08's broader handling of
  post-submission changes; actual sandbox acceptance remains ticket 09.

## Independent completion verification (2026-10-27)

Historical findings below are addressed by the completion fixes above.

- Reviewed commit `54c240a` against the acceptance criteria. No implementation
  changes were made during verification.
- **P2 — replay persistence is not atomic with resolution.**
  `backend/app/services/courier_reconciliation.py` commits the attempt/audit in
  `_apply` before reading the current review and saving the idempotency record.
  Injecting a failure in `save_idempotency_record` leaves one applied resolution;
  retrying the identical payload/key returns `409 ATTEMPT_NOT_RECONCILABLE`
  instead of replaying success. The temporary fault-injection test reproduced
  this failure and was removed after execution. Persist a durable replay outcome
  with the resolution, or recover it from the recorded operation; also recheck
  same-key replay after acquiring locks. Add failure-window and simultaneous
  same-key regression coverage, including PostgreSQL.
- **P2 — cancelled-order recovery lacks the external-action warning.**
  `frontend/src/features/seller/CourierReview.tsx` shows recovered success and
  `ORDER_NOT_CONFIRMED`, but does not explain that local cancellation has not
  cancelled the recovered Pathao booking or that the seller must resolve it in
  Pathao. The cancelled-order backend test asserts only the lifecycle blocker.
  This overlaps ticket 08, which is still ready-for-agent; ticket 07's explicit
  warning acceptance criterion cannot yet be signed off. Add component coverage
  for cancellation followed by recovered success.
- Fresh focused verification: **14 backend passed, 0 skipped**, including five
  PostgreSQL tests against isolated schemas on loopback port 5432;
  **5 seller reconciliation component tests passed**.
- Full gate: **PASS**, all eight stages, result
  `.cache/checks/check-aLirns/result.json`. Initial run `check-IUBonj` failed on
  Windows system-temp permissions; the successful rerun used workspace-local
  TEMP/TMP and the isolated PostgreSQL test fixtures. Passing existing suites
  does not close the two uncovered acceptance gaps above.
- Browser, physical-device, real Pathao/Clerk, sandbox lookup, and hosted
  migration acceptance: **NOT RUN**. Evidence remains local/simulated.
- Next action: fix the replay failure window and resolve the warning dependency,
  add the missing regression cases, then repeat focused tests and the full gate.

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
