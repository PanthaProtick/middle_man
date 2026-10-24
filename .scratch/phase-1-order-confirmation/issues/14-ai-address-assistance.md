# 14: Use optional AI address suggestions

**What to build:** A buyer deliberately requests address assistance, reviews editable suggestions and can complete the order manually through any AI failure.

**Blocked by:** [03: Submit buyer details and see pending status](03-manual-buyer-submission.md)

**Status:** completed

## Acceptance criteria

- [x] Explain address data transfer to Gemini before explicit opt-in; backend-only adapter keeps keys out of the browser and remains replaceable by an offline test double.
- [x] Return validated nullable district/thana/area/street/landmark and clarification suggestions; unknowns remain null and buyer review is required before submission.
- [x] Do not let text instructions change authority, invoke tools or bypass schema validation. No assistance response becomes an order submission or payment confirmation.
- [x] Bound timeouts/retries; malformed/unavailable responses return a clear manual fallback. Late responses never overwrite reviewed input.
- [x] Restrict to unsubmitted, unexpired orders and existing public-access gate. Persist committed extraction outcomes for replay without promising exactly-once provider billing.
- [x] Register raw request/response evidence ownership and original 30-day deadlines, without permanent raw audit/log copies; disclose retention and keep normal manual path AI-free.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

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



## Implementation evidence — 2026-10-24

- Added typed opt-in extraction endpoint, nullable suggestion schema, backend-only replaceable Gemini adapter, and order/shop-owned PostgreSQL extraction records (migration 0013).
- Public gate remains default-deny. Only unsubmitted, unexpired orders are eligible, including replay; recheck time after lock acquisition and provider completion. No extraction submits orders or confirms payments.
- Same-key outcomes commit before acknowledgement; changed payload conflicts. Five distinct calls per order bound amplification. Zero automatic retries; five-second HTTP and six-second total provider timeout. Order-level locking serializes extraction/replay/submission at the cost of up to six seconds of order contention. Provider success followed by a lost DB commit can still incur duplicate billing on retry.
- Raw request/response evidence belongs to shop/order with original collection time and 30-day deadline, separate from structured replay results. No raw audit/generic-idempotency copies. Ticket 16 owns scheduled raw deletion/overdue reporting; provider, backup and completed-order retention launch gates remain open.
- React form explains address transfer/retention before explicit consent; separate editable nullable review fields only replace the readable address after buyer action. Manual form works during loading and every failure. Edits/submission/unmount invalidate late responses. Transport retries preserve address/key.
- Changed paths: backend/app/api/public_orders.py; backend/app/models/address_assistance.py, address_entities.py; backend/app/services/address_assistance.py, address_provider.py; backend/migrations/0013_address_extractions.sql; backend/tests/test_address_routes.py, test_address_adapter.py, test_address_postgres.py; frontend/src/features/buyer/AddressAssistance.tsx, AddressAssistance.test.tsx, BuyerSubmissionForm.tsx; backend/pyproject.toml, uv.lock; docs/API_CONTRACTS.md; synthetic browser launcher .scratch/phase-1-order-confirmation/address_browser.py.
- Focused API: PASS, 10 cases. Adapter HTTP-double integration: PASS, 1 case. Frontend: PASS, 7 cases. Typechecking: PASS.
- Disposable PostgreSQL: PASS, 2 new cases (durable replay/ownership/deadline and concurrent same-key serialization). Verified 127.0.0.1:55447, postgres database, data directory E:/middle_man/.cache/resolution-pg before schema operations; fixtures create/drop unique schemas.
- Browser: PASS with production build + synthetic provider + real isolated PostgreSQL: loading, editable review/apply, provider outage, manual completion to pending. Screenshot: .cache/address-browser-proof.png. Harness schema and case: .cache/address-browser.json. Late/null/malformed/offline cases additionally covered by React tests.
- Root `npm run check` with explicit disposable PostgreSQL URL: PASS all 8 stages, 240 backend tests and 75 frontend tests. Fresh artifact: .cache/checks/check-hvQ09B/result.json.
- Dependency metadata: promoted existing HTTPX package to runtime; `uv lock --check --offline`: PASS. Initial offline re-resolution could not find uncached packages; no package versions changed.
- Configured Gemini / current model and data-terms acceptance: NOT RUN. Live auth/deployment/production migration: NOT RUN and not authorized. No readiness claim from settings alone.
- Next action: ticket 15 optional screenshot assistance, and ticket 16/shared launch gates for retention, approved access policy and configured-provider validation.

- Required two-axis review: Standards — no actionable findings. Spec — one response-contract mismatch found and fixed across backend/provider/React/tests/docs: `available`, `needs_clarification`, `clarification_question` now match the normative contract. Focused API/adapter (11) and React (7) checks plus typechecking passed after the fix; final root gate rerun PASS all eight stages (.cache/checks/check-hvQ09B/result.json, 240 backend / 75 frontend).

- Final independent review recheck: Standards 0 findings; Spec 0 outstanding findings (contract finding resolved). Final browser build rechecked review/apply, outage fallback, and manual completion to pending. Synthetic server stopped after acceptance; isolated browser schemas retained locally for evidence only.
