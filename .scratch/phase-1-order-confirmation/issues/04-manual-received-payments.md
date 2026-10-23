# 04: Record and inspect received payments manually

**What to build:** A seller records observations from their payment app and reviews a durable inbox of received, unmatched or conflicting payments.

**Blocked by:** [01: Set up an authenticated shop and receiving accounts](01-seller-workspace.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Manual entry requires same-shop account, provider, TrxID and positive actual amount; sender and occurrence time may be unknown and remain visibly incomplete. Source/actor are server-derived.
- [ ] Enforce shop + provider + canonical TrxID identity in PostgreSQL. Sender/account changes are observations of that identity, never separate funds; independent shops remain separate.
- [ ] Identical observations are no-ops for payment value even with a new request key. Contradictory observations persist visibly and block automatic eligibility without silent overwrite.
- [ ] List/filter/page received records and observations with unknown/parse/conflict/used state; private detail/history never leaks through a buyer projection.
- [ ] Support durable idempotent entry, explicit outage/stale errors and typed input validation in the seller form/inbox, without requiring orders to exist.
- [ ] Retain only necessary structured observations and collection metadata; do not invent retention for standalone unmatched structured receipts. Keep real-data use gated until that policy is settled.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC03, AC05, AC14, AC17, AC18, AC37, AC38, AC39, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API identity/duplicate/scope/incomplete-entry tests; real PostgreSQL uniqueness and restart checks; browser entry, repeat entry and contradictory observation display. Reconciliation is added by ticket 05.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

