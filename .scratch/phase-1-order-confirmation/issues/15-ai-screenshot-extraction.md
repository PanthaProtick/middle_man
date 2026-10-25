# 15: Use optional AI screenshot extraction

**What to build:** A buyer opts into extraction from an attached screenshot and reviews suggested payment fields before submitting a claim.

**Blocked by:** [13: Attach optional screenshots privately](13-private-screenshot-upload.md)

**Status:** implemented — local acceptance passed; live launch gates remain

## Acceptance criteria

- [x] Explain screenshot transfer and require explicit buyer choice; backend accepts only evidence bound to the same eligible unsubmitted/unexpired order and existing public-access gate.
- [x] Return schema-validated nullable payment-screenshot flag, provider, TrxID, amount, sender, receiver, time and unreadable-field list. Unknown/low-confidence output never becomes verified receipt evidence.
- [x] Buyer edits/reviews suggestions through ordinary field validation; late output cannot overwrite reviewed values or silently submit/confirm an order.
- [x] Use bounded backend-only Gemini calls, request isolation and prompt-injection-resistant authority boundaries; no keys in browser and no SMS-to-AI path.
- [x] Persist replayable committed results, bound lost-response retries without exactly-once billing claims, and keep manual submission available on every extraction failure.
- [x] Track raw model evidence with original 30-day deadlines and protected ownership; reprocessing cannot extend original evidence retention or copy raw content into permanent logs.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

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



## Implementation and verification — 2026-10-24

- Added typed `payment-extraction` public API and backend-only tool-free Gemini image adapter. Literal boolean consent, existing public gate, order eligibility, and same-order/shop staged evidence checks precede private reads/provider work. Invalid, unknown or malformed model output yields manual fallback; no seller receipt, allocation or confirmation is created.
- Added migration `0014_payment_extractions.sql` and durable shop/order/evidence-owned extraction records. A pending reservation commits before external work; same-key unfinished attempts return `EXTRACTION_OUTCOME_UNKNOWN` without another provider call. Committed successes/failures replay. Five distinct attempts cap crash/lost-response retries; no exactly-once billing claim. The bounded call holds order/evidence locks (up to six seconds), trading contention for safe submission serialization.
- Raw model output inherits the screenshot's original collection/deletion times. Reprocessing/replay cannot extend the original 30-day deadline; no raw image duplication in extraction records or permanent log/audit content. `purge_payment_raw_evidence` is a tested transaction-owned cleanup seam; scheduled cleanup/overdue reporting remains ticket 16, and backup/provider purge remains a launch gate.
- Integrated `PaymentAssistance` into the buyer form. Explicit transfer disclosure/choice, loading, nullable/unreadable fields, review/edit/use, malformed/network fallback and same-key retry are supported. Late results are invalidated by payment edits, evidence changes, submission/locking or navigation. Reviewed suggestions feed ordinary claim validation; receiver/time remain context and cannot rewrite the designated seller account. Manual fields and submission remain available.
- Changed paths: backend public route, payment models/services/migration/tests; frontend buyer form, review component/parser/tests; `docs/API_CONTRACTS.md`; synthetic browser launcher `.scratch/phase-1-order-confirmation/payment_extraction_browser.py`.
- TDD: initial API test failed for missing payment provider module, then passed after implementation; initial component test failed for missing review component, then passed. User agreed API/React/disposable PostgreSQL seams before tests.
- Focused verification: PASS `npm run test:backend -- tests/test_payment_extraction.py tests/test_payment_adapter.py tests/test_payment_postgres.py` (18 tests including 3 real PostgreSQL cases); PASS `npm run test:frontend -- src/features/buyer/PaymentAssistance.test.tsx` (8 tests); PASS `npm run typecheck`.
- Disposable PostgreSQL: PASS. Before schema operations verified `127.0.0.1:55447`, database `postgres`, data directory `E:/middle_man/.cache/resolution-pg`. Unique disposable schemas exercised migrations, ownership/deadlines/purge, concurrent replay, crash reservations and budget exhaustion; no hosted database used.
- Browser: PASS using integrated production build and explicit offline image provider, served on loopback 8015 with isolated PostgreSQL schema. Exercised synthetic PNG upload, transfer choice, loading, unreadable receiver/time, editable suggested TrxID, explicit application, simulated lost extraction response preserving reviewed input, and manual submission ending in Pending Seller Review. Proof: `.cache/payment-extraction-browser-proof.png`. Harness/schema stopped/removed after acceptance.
- Required code-review skill: Standards 0 actionable findings; Spec 0 actionable findings, independently reviewed staged changes against starting commit `8176663a00c9b90b03a7a155362c2f5c0bef0f55`.
- Final root gate: PASS `npm run check` with disposable PostgreSQL enabled — all 8 stages, 258 backend tests, 83 frontend tests across 19 files, strict types, lint, production build and HTTP smoke. Fresh result: `.cache/checks/check-uWKoLb/result.json`.
- Configured Gemini/image provider and current service-data terms: NOT RUN. Hosted migration/deployment and private-storage ACL acceptance: NOT RUN. Scheduled/raw backup/provider purge acceptance: deferred launch gates, not established by local tests.
- Next action: implement ticket 16's scheduled retention/deletion behavior, wiring the raw payment-output purge seam into its worker. Complete separate live-provider/storage/auth/access-policy launch acceptance before real-data operation.

- 2026-10-25 self-test policy update (self-test ticket 06): SELF_TEST_MODE now suppresses payment extraction, including cached suggestions, regardless of credentials. Public availability hides transfer controls; optional screenshots and manual entry remain available. Existing enabled-mode tests pass. Final offline root gate: .cache/checks/check-hFDsOD/result.json; live/browser/PostgreSQL acceptance was not rerun for this policy change.
