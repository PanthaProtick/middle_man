# 03: Submit buyer details and see pending status

**What to build:** A buyer completes a mobile manual form and sees a durable pending acknowledgement without needing an account, screenshot or AI.

**Blocked by:** [02: Create an order and retrieve its buyer link](02-create-order-links.md)

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Display only public shop/order/payment instructions, copy receiving number, and immutable terms. Require reviewed readable address, name, contact, full payment sender, provider, TrxID and claimed amount.
- [ ] Validate contact independently from sender; support specified Bangla-digit/local/+880 canonicalization while preserving raw reviewed values. Trim TrxID boundaries without undocumented normalization.
- [ ] Atomically accept first completed submission strictly before server expiry; at/after deadline return expired. Initial submission is single-use, idempotent and persists buyer/claim revisions, server timestamps and pending status.
- [ ] Completed submissions never expire automatically. Opening/drafting the form does not count; show status instead of a buyer editing/resubmission loop after success.
- [ ] Preserve entered values on recoverable failures, use the same key/payload after unknown outcomes, and never treat a local optimistic record as saved. Include Bangla/English mobile labels and accessible validation.
- [ ] Keep live public operations disabled until buyer-access/projection policy is settled; use explicit non-live permission adapters for demonstrations. Token possession never permits seller edits.
- [ ] Record minimal durable aggregate link-open/submission measurements without raw personal data; distinguish repeat/bot opens and unknown commits from unique buyers, and do not claim identity proof.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC05, AC07, AC08, AC09, AC28, AC31, AC32, AC33, AC37, AC38, AC39, AC44, AC45, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

FastAPI submission/privacy/expiry/idempotency tests; real PostgreSQL concurrent deadline/submission and restart checks; frontend manual-only/error tests; browser mobile submit/reload with explicit non-live access permissions.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

