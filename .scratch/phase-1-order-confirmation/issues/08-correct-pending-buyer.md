# 08: Correct pending buyer information

**What to build:** An owning seller uses the existing portal to correct pending buyer details or payment claims and sees checking run again.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Resolve the buyer link/token to an owning-seller order only through authenticated seller authority; anonymous/token-only access cannot enable corrections.
- [ ] Edit pending name/contact/address and payment claim with reason and expected version; preserve prior revisions, actor and server times.
- [ ] Payment-claim changes use the active claim revision's server acceptance time for matching; delivery-only corrections do not extend that bound or erase first submission time.
- [ ] Reconcile relevant corrections through the same allocator, preserve pending nonexpiry and report updated private review reasons or confirmation.
- [ ] Reject concurrent stale edits and correction-versus-confirmation races without last-write-wins; confirmed payment/terms cannot be changed through this interface.
- [ ] Show edit/history/error states, preserve recoverable inputs and provide no buyer reject/resubmit loop. Completion/exception aggregate counts must not double-count revisions.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC23, AC27, AC28, AC30, AC33, AC37, AC38, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API authorization/revision/timing/nonexpiry tests; real PostgreSQL correction-versus-allocation contention; browser seller login through existing link, correction and renewed outcome.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

