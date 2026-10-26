# 01: Create courier drafts on confirmation

**What to build:** When an order becomes confirmed through manual seller acceptance or automatic payment matching, its owning seller can see one persistent local courier draft with the recipient information, remaining COD balance, and reasons booking is not yet available. Confirmation does not contact Pathao.

**Blocked by:** None (can start immediately).

**Status:** completed

## Implementation record — 2026-10-26

- Shared allocation writes a unique durable order-level courier creation marker;
  offline allocation prepares its marker before changing confirmation state.
- Seller-only `GET /api/seller/orders/{order_id}/courier-draft` projects the current
  buyer revision and accepted allocation. No second copy of recipient data is
  stored; retention deletes the marker and invalidates the endpoint.
- The order modal displays a local proposal, actionable setup/parcel/location
  blockers and actual COD. Shared seller session guards and identity-bound state
  protect requests; order-version changes reload the proposal after corrections
  or cancellation.
- Automatic reconciliation now retries inside a savepoint. A new trigger-induced
  failure test exposed the prior full rollback silently discarding submission and
  reporting HTTP 200 with an unsubmitted order; exhausted failures now reach the
  outer transaction and return 503, and same-key retries safely confirm.
- Changed paths: `backend/app/{api/courier.py,models/courier.py,services/courier_drafts.py}`,
  shared allocation/reconciliation/retention/reset wiring, database readiness,
  migration 0019, courier HTTP/PostgreSQL tests and migration inventory test;
  seller CourierDraft/CourierWorkflow components/tests and modal integration;
  `docs/API_CONTRACTS.md`.
- Review: independent Standards and Spec reviews each found the missing modal
  version refresh; fixed and covered by a cancellation workflow regression.
  Additional review accepted the savepoint correction with no new findings.
- Focused results: 6 offline courier HTTP tests, 8 courier PostgreSQL tests,
  4 seller component/workflow tests passed. Broader PostgreSQL confirmation,
  exception and buyer transaction tests passed (20 cases before the final
  current-recipient assertions were added; courier PostgreSQL then reran 8/8).
- Full gate: PASS `npm run check`; 520 backend tests (including local PostgreSQL),
  160 frontend tests, tooling, lint, strict types, production build and HTTP smoke.
  Evidence: `.cache/checks/check-RAhuQ0/result.json` and adjacent logs.
  Earlier attempts found import ordering, migration inventory drift and Windows
  pytest temp permissions (487 passed, 1 failed, 32 setup errors); the next run
  passed 519 with only the already-loaded old migration-prefix assertion failing.
  The fresh final run passed all 520. Verification uses `SELF_TEST_MODE=false`, a
  disposable loopback PostgreSQL instance and repository-local pytest scratch.
- Limits: no live courier requests/bookings, hosted migration, physical-device
  acceptance or manual browser journey. No production database was changed.
- Next action: ticket 02 remains separate; no courier connection, parcel editing
  or provider submission is enabled here. Commit only this ticket's files on the
  current branch and preserve prior checkout work.

### Standards review

One finding: the modal retained its proposal after order changes. Fixed by
including order version in the key and covered by a cancellation workflow test.
No outstanding standards violations or actionable smell findings.

### Spec review

One finding: the same stale proposal violated current-recipient behavior. Fixed;
PostgreSQL coverage verifies current corrected recipient details with unchanged
accepted COD and draft identity. Additional savepoint review found no new issue.

Review totals: Standards 1 resolved / 0 outstanding; Spec 1 resolved / 0 outstanding.

- [x] Both manual and automatic confirmation use the existing shared allocation boundary to persist exactly one draft or durable draft-creation work atomically with confirmation. Do not depend on a browser event or only the manual-decision operation.
- [x] An order-level uniqueness constraint and equivalent offline behavior prevent duplicate drafts under replay, repeated reconciliation, concurrent processing, and process restart.
- [x] The owning seller can retrieve and view the draft in the order workflow. Other sellers and public buyer-link holders cannot read private courier state or perform seller courier actions.
- [x] Populate the recipient from current buyer details, using the buyer contact number rather than the payment sender number. Derive remaining COD from the order total minus the advance actually accepted by the seller; include exception advances and zero collection without changing existing overpayment safeguards.
- [x] Label the draft as a local proposal, not an accepted Pathao booking or independently verified payment. Missing parcel details, courier connection, or location metadata appear as actionable blockers.
- [x] Confirming an order without courier setup still succeeds. No provider request occurs during the confirmation transaction, and local failures cannot leave a falsely reported successful half-write.
- [x] Reuse existing seller session-loss and late-response protections when displaying a draft. Loading, unavailable, and access-denied states expose no previous shop's private data.
- [x] Keep migrations and the in-memory adapter consistent, including invalidation/redaction of newly exposed buyer-derived data under existing retention rules. Preserve unrelated checkout changes and existing assertions.
- [x] Verify through the established HTTP API/PostgreSQL seam: manual acceptance, automatic reconciliation with either input arrival order, accepted-advance COD, cross-shop denial, replay, restart, uniqueness, and atomic local failure. Add seller component coverage for visible draft/blocker states.
- [x] Run focused tests during implementation and root `npm run check` as the final gate. Record actual results and distinguish local/offline evidence from browser or provider acceptance. No live courier booking is enabled by this ticket.
