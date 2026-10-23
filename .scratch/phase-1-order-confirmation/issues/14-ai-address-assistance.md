# 14: Use optional AI address suggestions

**What to build:** A buyer deliberately requests address assistance, reviews editable suggestions and can complete the order manually through any AI failure.

**Blocked by:** [03: Submit buyer details and see pending status](03-manual-buyer-submission.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Explain address data transfer to Gemini before explicit opt-in; backend-only adapter keeps keys out of the browser and remains replaceable by an offline test double.
- [ ] Return validated nullable district/thana/area/street/landmark and clarification suggestions; unknowns remain null and buyer review is required before submission.
- [ ] Do not let text instructions change authority, invoke tools or bypass schema validation. No assistance response becomes an order submission or payment confirmation.
- [ ] Bound timeouts/retries; malformed/unavailable responses return a clear manual fallback. Late responses never overwrite reviewed input.
- [ ] Restrict to unsubmitted, unexpired orders and existing public-access gate. Persist committed extraction outcomes for replay without promising exactly-once provider billing.
- [ ] Register raw request/response evidence ownership and original 30-day deadlines, without permanent raw audit/log copies; disclose retention and keep normal manual path AI-free.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC09, AC10, AC28, AC31, AC32, AC37, AC38, AC40, AC44, AC45, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API opt-in/schema/expiry/privacy/replay tests with provider doubles; frontend malformed/null/late/offline tests; browser review/manual fallback. Current Gemini terms/model and actual configured-provider behavior remain separate launch evidence.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

