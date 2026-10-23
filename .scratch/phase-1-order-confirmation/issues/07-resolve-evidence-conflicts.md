# 07: Resolve conflicting evidence and competing claims

**What to build:** A seller compares conflicting observations or competing orders and records an explicit resolution that lets an eligible exact match proceed.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Present same-shop receipt observations, competing active claims, mismatch explanations and existing allocation state without publicly labelling a buyer fraudulent.
- [ ] Require owning-seller authority, expected version and reason to select consistent unallocated evidence or resolve competing claims; preserve the observations and rejected alternatives as history.
- [ ] Resolving a competing claim is an explicit audited seller decision, not an automatic first-submitter preference; ineligible/unresolved claims remain held rather than silently receiving funds.
- [ ] Reconcile after committed resolution; exact eligible outcomes use the existing atomic single-use allocator. Do not introduce amount/sender/time override controls until ticket 10.
- [ ] Late contradictory evidence or claims alert the seller but cannot edit an accepted allocation, undo confirmation or release the payment.
- [ ] Resolve stale/unknown outcomes by refetch/same-key retry and show meaningful UI conflicts; concurrent resolution cannot allocate twice.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC18, AC19, AC20, AC21, AC22, AC24, AC30, AC37, AC38, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API resolution/audit/privacy tests; real PostgreSQL concurrent competing-resolution checks; browser compare, resolve and verify one accepted order while another remains unresolved.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

