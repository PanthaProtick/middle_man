# 15: Use optional AI screenshot extraction

**What to build:** A buyer opts into extraction from an attached screenshot and reviews suggested payment fields before submitting a claim.

**Blocked by:** [13: Attach optional screenshots privately](13-private-screenshot-upload.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Explain screenshot transfer and require explicit buyer choice; backend accepts only evidence bound to the same eligible unsubmitted/unexpired order and existing public-access gate.
- [ ] Return schema-validated nullable payment-screenshot flag, provider, TrxID, amount, sender, receiver, time and unreadable-field list. Unknown/low-confidence output never becomes verified receipt evidence.
- [ ] Buyer edits/reviews suggestions through ordinary field validation; late output cannot overwrite reviewed values or silently submit/confirm an order.
- [ ] Use bounded backend-only Gemini calls, request isolation and prompt-injection-resistant authority boundaries; no keys in browser and no SMS-to-AI path.
- [ ] Persist replayable committed results, bound lost-response retries without exactly-once billing claims, and keep manual submission available on every extraction failure.
- [ ] Track raw model evidence with original 30-day deadlines and protected ownership; reprocessing cannot extend original evidence retention or copy raw content into permanent logs.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC09, AC10, AC11, AC28, AC31, AC32, AC37, AC38, AC40, AC44, AC45, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API foreign-image/opt-in/output-schema/retry tests; frontend unreadable/malformed/late/manual fallback cases; browser extraction review using an explicit offline adapter. Actual Gemini/image-provider acceptance is reported separately.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

