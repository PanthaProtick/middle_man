# 11: Cancel, reject or replace an order

**What to build:** A seller deliberately stops or replaces an order, with a reason, accurate buyer status and preserved payment history.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Allow lifecycle-valid cancellation and rejection with reason, expected version and first terminal completion time; provide terminal buyer views directing contact with seller, without self-resubmission.
- [ ] Cancellation stops matching and preserves allocation/used markers/history; cancellation or rejection never implies a refund or frees consumed funds.
- [ ] Atomically replace an unallocated eligible predecessor with cancellation plus a linked new order containing fresh immutable terms/token. Never transfer buyer claims or money silently.
- [ ] Allocated predecessors return PAYMENT_RESOLUTION_REQUIRED; Phase 1 does not implement payment reassignment or refund resolution.
- [ ] Keep old/new seller links and history traceable while enforcing shop access and buyer projection privacy.
- [ ] Cancellation/replacement-versus-matching and stale decisions resolve through the shared transaction boundary; idempotent retries cannot create extra replacements.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC23, AC30, AC34, AC35, AC36, AC37, AC38, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API transition/replacement/reason/scope tests; real PostgreSQL cancellation/replacement-versus-allocation contention; browser stop/replace and buyer terminal views.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

