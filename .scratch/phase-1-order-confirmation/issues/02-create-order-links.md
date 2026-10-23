# 02: Create an order and retrieve its buyer link

**What to build:** A seller creates an order with final agreed terms, shares its unique link, and retrieves the same durable order and deadline later.

**Blocked by:** [01: Set up an authenticated shop and receiving accounts](01-seller-workspace.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Create, list/filter/page and inspect same-shop orders with product, final total including agreed charges, required advance and active receiving account; reject unsafe/invalid money or advance above total.
- [ ] Snapshot commercial terms and receiving-account details. Relabel/deactivate of the account never rewrites an existing order's destination; do not permit generic term edits.
- [ ] Generate an opaque unpredictable unique portal token, protect its lookup/retrieval material and exclude it from ordinary logs/referrers/shared caches. Seller retrieves the link only with owning-shop authority.
- [ ] Use server UTC creation time and a 48-hour deadline, displayed with an explicit Bangladesh zone. Unsubmitted links become expired, including on reads; drafts and opening links do not extend the deadline.
- [ ] Provide seller create/list/detail/copy-link behavior, clear expected COD labels and durable reload after restart; no fabricated success on failed writes.
- [ ] Keep key-scoped create replay and expected-version semantics; collect first terminal completion time once for later retention.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC04, AC05, AC06, AC31, AC32, AC37, AC38, AC39, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API money/account/scope/token/retry tests; disposable PostgreSQL restart persistence; frozen-time expiry tests; browser order creation, link retrieval and account snapshot demonstration. Submission-boundary races are completed in ticket 03.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

