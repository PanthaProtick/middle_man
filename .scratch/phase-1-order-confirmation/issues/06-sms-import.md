# 06: Import payment SMS with manual fallback

**What to build:** A seller pastes single or bulk incoming-payment SMS for a selected account, sees each result and completes unsupported records through manual entry.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Accept bounded batches (initially 50 messages/64 KiB) for an owning-shop account; deterministic supported-format parsing yields explicit provider/TrxID/amount/sender/time fields.
- [ ] Show per-item unsupported, missing, masked, ambiguous and conflicting results. Successful items remain durable in mixed batches; never guess sender digits, payment time or receiving destination.
- [ ] Send successful observations through existing identity/deduplication and reconciliation, supporting both arrival orders and replay after raw SMS deletion.
- [ ] Never invoke Gemini for SMS. Provide a visible path to the existing manual receipt form; pasted buyer screenshots are not seller receipt evidence.
- [ ] Privately associate raw SMS with its owner, collection time and 30-day deletion deadline on ingestion; re-import/reprocess does not extend an existing raw object's deadline or copy raw text into permanent audit/logs.
- [ ] Support idempotent batch retries, seller-only inbox/result views and bounded explicit failures. Record which sanitized permissioned formats are tested; unsupported Nagad/bKash formats remain failures rather than broad provider-support claims.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC13, AC14, AC15, AC16, AC17, AC18, AC21, AC37, AC39, AC40, AC49, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API mixed-batch/duplicate/conflict/parser tests with zero outbound AI calls; real PostgreSQL receipt/import durability; frontend per-item errors and browser paste-to-confirm/manual fallback. Representative live-format acceptance remains a separate gate.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

