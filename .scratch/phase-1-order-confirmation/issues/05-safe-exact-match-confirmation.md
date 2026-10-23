# 05: Confirm exact payment matches safely

**What to build:** A qualifying buyer claim and seller received-payment record confirm the order exactly once, whichever arrives first, with correct actual COD visible to buyer and seller.

**Blocked by:** [03: Submit buyer details and see pending status](03-manual-buyer-submission.md); [04: Record and inspect received payments manually](04-manual-received-payments.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] On accepted claim or receipt arrival reconcile same-shop eligible pending orders using provider, designated account, TrxID, full canonical sender, exact required advance and clear seller payment time.
- [ ] Require order creation <= seller payment time <= active claim's server submission time. Missing/masked sender, ambiguous time, mismatch or conflicting observations produce durable typed seller review reasons, not inferred evidence.
- [ ] Check all known competing active claims, including sender-mismatch claims; hold them without first-submitter preference. Claims do not reserve funds; a later claim cannot reverse a committed confirmation and alerts the seller.
- [ ] Commit allocation, actual accepted amount/COD, confirmation basis, completion time, used marker, audit and idempotent result atomically. PostgreSQL enforces at most one allocation per receipt and per order with shop-safe references.
- [ ] Use consistent locking/revalidation, bounded serialization retry and independent-request tests. Missing marker protection fails closed; a process-local lock or in-memory confirmation is insufficient.
- [ ] Recompute missed pending reconciliation after restart; outages/rollback cannot leave partial confirmation. Preserve prior allocations on contradictory later evidence.
- [ ] Show confirmed/pending outcomes immediately on buyer status and seller detail with actual versus expected balance labels, private review reasons only for seller, and minimal confirmation/exception aggregates.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC03, AC07, AC08, AC12, AC13, AC14, AC15, AC16, AC17, AC18, AC20, AC21, AC22, AC37, AC38, AC39, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API matching matrix, both arrival orders, duplicate/conflict/late-claim cases; mandatory disposable PostgreSQL independent-connection contention, rollback, idempotency and restart tests; browser manual receipt-to-buyer confirmation. Later manual/correction/cancellation tickets must extend the same transaction boundary.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

