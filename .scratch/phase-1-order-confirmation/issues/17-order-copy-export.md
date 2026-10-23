# 17: Copy and export order summaries

**What to build:** A seller copies or downloads same-shop order summaries for manual delivery handling with correctly labelled balances.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Offer same-shop filtered CSV export and readable copy summaries with fixed total, required/accepted advance, lifecycle and expected versus actual COD distinction.
- [ ] Enforce seller identity/ownership on export and included fields, with stable typed filters, bounded resource use and explicit unavailable/rate-limit errors.
- [ ] Neutralize spreadsheet formula-like buyer input including delimiter/newline/quote cases while preserving readable values; do not leak private evidence URLs/tokens or another shop's data.
- [ ] Provide browser copy/download controls, progress/empty/error feedback and direct order detail consistency; literal export operations cannot be swallowed by generic order lookup.
- [ ] Describe exports as manual delivery aids only; no courier booking, courier update or delivery-price calculation.
- [ ] Link the existing pilot timing procedure from workflow guidance so seller setup/import/review effort and buyer completion can be compared with baseline; do not add a broad analytics dashboard.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC05, AC12, AC37, AC47, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API scope/filter/balance/formula-safe serialization tests; frontend error/copy/download tests; actual browser CSV import/readability and copied summary checks.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

