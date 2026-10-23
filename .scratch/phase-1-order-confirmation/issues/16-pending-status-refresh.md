# 16: Refresh pending status reliably

**What to build:** A buyer refreshes a pending order manually or watches it reach a final status without runaway polling or stale responses.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md); [11: Cancel, reject or replace an order](11-order-outcomes-replacement.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Reuse existing durable public status and privacy projection; basic pending/confirmed/terminal views must already work without this enhancement.
- [ ] Poll pending status every 30 seconds only while visible; support manual refresh and bounded backoff for transient errors/rate limits.
- [ ] Stop on terminal outcome, retained-record unavailability, hidden/unmounted page or request cancellation; resume visibility appropriately without duplicate loops.
- [ ] Ignore out-of-order responses so confirmed/cancelled/rejected/expired views cannot regress to pending; do not fabricate success from a cache.
- [ ] Show loading, offline/unavailable and safe retry states without revealing private receipt/review/personal details; retain the live public-policy gate.
- [ ] Render actual accepted COD on confirmation, contact-seller guidance on stopped orders and nonexpiry for submitted pending orders.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC33, AC34, AC35, AC37, AC44, AC45, AC46, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

Frontend fake-clock/network-order/unmount tests, API projection regressions and actual browser visibility/offline/manual-refresh/terminal-stop flows. Fake timers alone do not establish browser lifecycle behavior.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

