# 01: Set up an authenticated shop and receiving accounts

**What to build:** A seller signs into an isolated shop, creates labelled bKash/Nagad receiving accounts and reloads durable settings.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Enforce verified seller identity and owning-shop scope on reads and writes; missing/invalid identity returns 401, unavailable verification returns 503, and foreign objects return 404 without existence details.
- [ ] Shop setup is idempotent and creates one pilot shop per owner; accounts support listing, creation, label changes and deactivation with version checks.
- [ ] Persist setup in PostgreSQL, with migrations and ownership constraints; referenced provider/receiving number cannot be changed. Inactive accounts cannot be selected for new orders.
- [ ] Provide a complete setup/settings screen with typed payloads, field validation, loading/empty/error states and same-key retry after uncertain writes.
- [ ] Credential-free development uses an explicit injected non-live identity adapter; request headers and configuration flags alone never establish live authentication.
- [ ] Establish privacy-safe aggregate measurement boundaries and the existing pilot baseline procedure without collecting buyer details or adding an analytics dashboard.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC01, AC02, AC05, AC06, AC37, AC38, AC39, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API authorization/validation and idempotency tests; disposable PostgreSQL durability/ownership checks; frontend setup/error tests; browser setup and reload. Configured seller-provider acceptance is separate.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

