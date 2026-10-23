# 19: Remove completed personal records without releasing payments

**What to build:** Completed personal records are removed after the agreed period while unresolved evidence remains available and previously consumed payments cannot be reused.

**Blocked by:** [08: Correct pending buyer information](08-correct-pending-buyer.md); [09: Correct unallocated seller transaction records](09-correct-unallocated-receipts.md); [11: Cancel, reject or replace an order](11-order-outcomes-replacement.md); [12: Correct confirmed delivery details](12-confirmed-delivery-corrections.md); [18: Run raw-evidence cleanup and expose failures](18-raw-evidence-cleanup.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Compute 12 calendar months from first confirmed/rejected/cancelled/expired completion, using month-end handling where needed. Later edits/cancellation do not restart the clock.
- [ ] Delete completed-order personal data and eligible structured payment/audit records without deleting structured dependencies still needed by unresolved orders; raw originals still follow their separate 30-day deadline.
- [ ] Preserve minimal protected shop/provider/transaction-identity used markers while the shop is active, without buyer address/sender/raw evidence; enforce replay protection after structured details are removed.
- [ ] Marker-key absence or rotation must fail closed against reuse, including through import, manual confirmation and cancellation history; do not restore spendable funds on deletion.
- [ ] Provide neutral unavailable-record buyer/seller views rather than relabelling historical confirmations expired; expose durable cleanup failures/overdue status and safe retry after restart.
- [ ] Keep account deletion, standalone unmatched structured-receipt retention and backup purge policy explicitly unsettled where applicable; do not invent periods or claim live-data readiness until decisions and evidence are recorded.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

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

