# 10: Accept payment exceptions with a COD preview

**What to build:** A seller reviews an eligible payment exception and explicitly accepts the actual received advance after seeing the resulting COD balance.

**Blocked by:** [07: Resolve conflicting evidence and competing claims](07-resolve-evidence-conflicts.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Require an existing same-shop seller receipt, expected version and nonblank reason; show provider/account/sender/time/amount discrepancies and record any accepted exceptions.
- [ ] Preview total minus actual received amount. Accept positive actual amounts at most the total; never allow a typed smaller allocation to hide an excessive payment or split a receipt.
- [ ] Under/over-advance acceptance records actual amount and manual basis, then displays matching balances on seller detail and buyer confirmation.
- [ ] Use the existing atomic allocator, ownership checks and used markers; manual decisions cannot bypass single use, unresolved receipt evidence or another committed allocation.
- [ ] Payments exceeding the entire total stay unresolved for external handling; do not create refunds, credit, partial allocations or payment-reassignment endpoints.
- [ ] Extend version/idempotency and concurrency handling to manual-versus-automatic/manual decisions; retain audit and privacy-safe exception aggregates.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC13, AC14, AC15, AC20, AC21, AC22, AC24, AC25, AC26, AC37, AC38, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API negative/positive exception and cap tests; real PostgreSQL manual-versus-automatic/manual contention; browser amount-preview approval and excessive-payment refusal.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

