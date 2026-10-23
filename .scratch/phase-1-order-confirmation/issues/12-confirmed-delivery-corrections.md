# 12: Correct confirmed delivery details

**What to build:** An owning seller updates a confirmed buyer's name, contact or address with visible history while payment acceptance stays unchanged.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Allow only confirmed name/contact/address corrections with owning-seller identity, reason and expected version; reject token-only edits.
- [ ] Keep commercial terms, payment claim/receipt allocation, accepted amount and COD locked; reject extra/forbidden fields server-side rather than ignoring them.
- [ ] Retain actor/reason/revision history; do not restart completion or retention time when delivery details change.
- [ ] Provide a focused seller correction/history view and clear stale/error handling, preserving entered corrections on recoverable failures.
- [ ] Show that portal edits do not update courier bookings; make no courier calls and add no delivery-integration controls.
- [ ] Public status remains privacy-limited and confirmed; do not disclose corrected full buyer information through the portal projection.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC28, AC29, AC30, AC37, AC38, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API permitted/forbidden fields, audit, privacy and unchanged-balance checks; real PostgreSQL version/persistence tests; browser delivery correction with unchanged confirmed COD.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

