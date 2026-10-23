# 18: Run raw-evidence cleanup and expose failures

**What to build:** Raw SMS, screenshots and AI evidence are removed when their original 30-day deadlines arrive, and overdue cleanup is visible and recoverable.

**Blocked by:** [06: Import payment SMS with manual fallback](06-sms-import.md); [13: Attach optional screenshots privately](13-private-screenshot-upload.md); [14: Use optional AI address suggestions](14-ai-address-assistance.md); [15: Use optional AI screenshot extraction](15-ai-screenshot-extraction.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Run durable retryable cleanup against existing ownership/collection/deadline metadata for SMS, images, raw model requests/responses and failed/orphan staged uploads.
- [ ] Use original collection deadlines; reprocessing cannot reset them. Remove raw originals even where structured records remain necessary for unresolved orders.
- [ ] Evidence reads show explicit unavailability after deletion; order status, structured claims, accepted allocation, COD and used-payment markers remain unchanged.
- [ ] Expose owning-seller appropriate evidence deletion status and operational overdue/failure information without logging raw evidence or other shops' records.
- [ ] Handle storage/database outage and restart with safe repeat deletion; never acknowledge complete deletion before required copies are removed.
- [ ] Document and verify lifecycle for storage version history, backups and provider/log copies; unknown external purge behavior stays an explicit live-data gate rather than a false deletion claim.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC17, AC39, AC40, AC42, AC43, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

Frozen-time API and real PostgreSQL cleanup scheduling/restart/dependency tests; storage fault injection and replay-after-raw-deletion checks; browser retained-record/evidence-unavailable display; configured storage/purge evidence separately.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

