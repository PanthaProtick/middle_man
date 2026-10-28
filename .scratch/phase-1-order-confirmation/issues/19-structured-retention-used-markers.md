# 19: Remove completed personal records without releasing payments

**What to build:** Completed personal records are removed after the agreed period while unresolved evidence remains available and previously consumed payments cannot be reused.

**Blocked by:** [08: Correct pending buyer information](08-correct-pending-buyer.md); [09: Correct unallocated seller transaction records](09-correct-unallocated-receipts.md); [11: Cancel, reject or replace an order](11-order-outcomes-replacement.md); [12: Correct confirmed delivery details](12-confirmed-delivery-corrections.md); [18: Run raw-evidence cleanup and expose failures](18-raw-evidence-cleanup.md)

**Status:** implemented — local PostgreSQL/browser acceptance and final root gate passed; hosted/live gates remain open

## Acceptance criteria

- [x] Compute 12 calendar months from first confirmed/rejected/cancelled/expired completion, using month-end handling where needed. Later edits/cancellation do not restart the clock.
- [x] Delete completed-order personal data and eligible structured payment/audit records without deleting structured dependencies still needed by unresolved orders; raw originals still follow their separate 30-day deadline.
- [x] Preserve minimal protected shop/provider/transaction-identity used markers while the shop is active, without buyer address/sender/raw evidence; enforce replay protection after structured details are removed.
- [x] Marker-key absence or rotation must fail closed against reuse, including through import, manual confirmation and cancellation history; do not restore spendable funds on deletion.
- [x] Provide neutral unavailable-record buyer/seller views rather than relabelling historical confirmations expired; expose durable cleanup failures/overdue status and safe retry after restart.
- [x] Keep account deletion, standalone unmatched structured-receipt retention and backup purge policy explicitly unsettled where applicable; do not invent periods or claim live-data readiness until decisions and evidence are recorded.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC17, AC21, AC33, AC34, AC39, AC41, AC42, AC43, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

Frozen-time real PostgreSQL anniversary/dependency/restart/marker replay and key-failure tests; API privacy/neutral-projection tests; browser completed-record removal and unresolved-record preservation. Account-deletion and backup acceptance remain separate gates.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

## Implementation / review handoff — 2026-10-24

- Base commit: `df2ec3eeb25a10a59d7e8d8adf480d9bc70b35c8`; current branch retained.
- Prerequisite code traced: ticket 11 is present in commits `8ec473c`/`e43426b`
  despite its stale ticket status; ticket 18 is committed in the base. Their hosted
  acceptance is not implied by local implementation.
- Added migration `0017_structured_retention.sql`, typed structured-retention model,
  cleanup services (calendar scheduling, PostgreSQL, explicit memory adapter, replay
  redaction, access guard) and protected marker-key binding. Updated import,
  reconciliation, manual preview, buyer/seller views, receipt inbox and CSV exports.
- Added seller structured-retention endpoints, React `StructuredRetentionPanel`,
  workspace reload after cleanup, and API/operational policy documentation.
- Deletion preserves minimal order/allocation/receipt tombstones and independent
  consumed identity markers; retained shared receipt history is required by unresolved
  or not-yet-due orders. Key changes fail closed; restore the original protection
  key before retry. Account deletion, standalone unmatched retention, hosted cleanup
  scheduling, backup/version/provider purges remain launch gates.
- TDD seams explicitly approved by the user: public cleanup/replay services with
  disposable PostgreSQL; FastAPI permissions/projections; React/browser flows.
- Focused PASS: 12 retention backend cases (5 offline, 7 real PostgreSQL), 10 React
  cases across new panel and seller workspace, strict backend/frontend typecheck.
  Earlier focused receipt-correction PostgreSQL run: 7 passed with the new used-ID
  import rejection contract. Tests exposed and fixed nested JSON replay disclosure.
- PostgreSQL target verified before schema operations: database `postgres`, loopback
  `127.0.0.1:55447`, data directory `E:/middle_man/.cache/resolution-pg`; tests create
  and remove unique schemas. Failure/restart, key absence/rotation, leap anniversary,
  concurrent cleanup, cancellation clock and shared dependency behavior exercised.
- Browser PASS with synthetic identity/public gate and isolated PostgreSQL schema:
  seller removed 1 completed record and retained the unresolved order/receipt;
  old buyer link shows neutral unavailable record, pending buyer link stays pending.
  The disposable local launcher was removed during repository cleanup; current
  coverage is the maintained retention backend and React suites.
  Screenshots `.cache/retention-seller-browser.png`, `.cache/retention-buyer-browser.png`.
- NOT RUN: hosted migrations/scheduler, live Clerk/providers, real-data deletion,
  external storage versions/log copies and backup purge. No deployment authorized.
- Next action: independent standards/spec reviews, fix actionable findings, final
  root `npm run check`, record fresh artifact and commit on current branch.

## Final verification and review — 2026-10-24

- `npm run check` PASS, fresh artifact `.cache/checks/check-YNoNhB/result.json`.
  All 8 stages passed: tooling 16 tests, backend lint/types, backend 293 tests,
  frontend lint, frontend 105 tests in 23 files, production build and HTTP smoke.
  `BUYER_TEST_POSTGRES_URL` pointed at the verified disposable loopback database;
  full backend tests included all opt-in PostgreSQL cases. No skipped tests.
- `git diff --check` PASS. Strict typechecks also passed during implementation.
- Independent code-review skill axes: Standards found 0 documented breaches and
  1 possible duplication; consolidated SMS import-result redaction into a shared
  pure transformation before the final gate. Spec found 0 concrete findings.
  Remaining findings: Standards 0, Spec 0.
- Browser PASS as recorded above. Final source adds normal repository button/card
  styling; the root production build contains that UI. Synthetic launcher clears
  provider settings and requires a loopback disposable target. It is not a deployment
  entry point or evidence of hosted authentication/storage readiness.
- Hosting/scheduling, live authentication/providers and migrations, account deletion,
  standalone unmatched structured-receipt policy and external backup/version/log
  purge remain BLOCKED / NOT RUN launch gates; no real-data readiness claimed.
- Next action: deploy only under a separately authorized rollout after those policy,
  protection-key migration and provider/storage/scheduling gates are resolved.

