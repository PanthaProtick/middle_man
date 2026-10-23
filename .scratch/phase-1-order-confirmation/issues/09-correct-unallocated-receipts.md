# 09: Correct unallocated seller transaction records

**What to build:** A seller corrects an unallocated received-payment observation and sees affected pending claims checked against the retained history.

**Blocked by:** [07: Resolve conflicting evidence and competing claims](07-resolve-evidence-conflicts.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Require owning-shop authority, expected version and reason; retain original and corrected observations rather than overwriting evidence.
- [ ] Correct only unallocated receipt fields; allocated accepted fields stay locked and later contradictions remain alerts.
- [ ] Identity changes colliding with an existing shop/provider/TrxID require explicit conflict resolution; do not silently merge or clone spendable funds.
- [ ] Reconcile all affected pending claims after consistent correction using the existing transaction boundary and known-claim rules.
- [ ] Show before/after fields, related outcomes, history and actionable stale/collision errors. Unknown outcomes reuse the original key/payload.
- [ ] Concurrent receipt correction, conflict resolution and allocation produce one valid serialized result; no stale accepted evidence or double allocation.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC17, AC18, AC19, AC21, AC22, AC23, AC30, AC37, AC38, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API correction/collision/history tests; real PostgreSQL receipt-edit/allocation races and rollback; browser correcting a receipt to resolve a pending order.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

