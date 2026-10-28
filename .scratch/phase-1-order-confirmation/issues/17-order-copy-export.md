# 17: Copy and export order summaries

**What to build:** A seller copies or downloads same-shop order summaries for manual delivery handling with correctly labelled balances.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** implemented; browser clipboard-content/spreadsheet-import acceptance pending

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

## Implementation evidence — 24 October 2026

- Added authenticated literal `/seller/orders/export` CSV and per-order `/summary`
  routes before generic order lookup. Typed lifecycle/limit filters reject unknown
  query fields. Server derives shop scope and allowlists delivery fields, excluding
  evidence, payment claims and portal secrets.
- PostgreSQL reads at most 501 joined rows (500 exported), uses current buyer
  revision and immutable accepted allocation, and distinguishes expected/actual
  COD including retained allocations on cancelled orders. Five-second statement
  and two-second admission-lock timeouts fail with `EXPORT_UNAVAILABLE`.
- Ten requests/shop/minute are admitted under a shop row lock using durable audit
  events without personal export contents. Migration `0015_order_export_indexes.sql`
  adds budget and order-scan indexes. Memory standby remains an offline adapter.
- React controls in `OrderList` and `OrderDetailModal` use the new `OrderExport`
  component, fetch fresh summaries, show progress/empty/error feedback, and start
  authenticated blob downloads. Clipboard errors never report success.
- CSV quotes every cell and prefixes formula-like text including whitespace and
  control prefixes; embedded quotes, delimiters and newlines round-trip. Added
  manual-delivery workflow guidance in `docs/order-delivery-workflow.md`, linking
  the existing baseline procedure and whole-workflow pilot timing guidance.
- Focused checks PASS: `npm run test:backend -- tests/test_order_export.py`
  (8 tests), `npm run test:frontend -- src/features/seller/OrderExport.test.tsx`
  (4 tests), `npm run typecheck`, and the production frontend build.
- Real PostgreSQL PASS: `npm run test:backend -- tests/test_order_export_postgres.py`
  (4 tests), with `BUYER_TEST_POSTGRES_URL` pointing only to disposable loopback
  port 55487. Verified `SHOW data_directory` = this workspace's
  `.cache/order-export-pg` before migrations. Tests use fresh random schemas and
  cover buyer CSV/balances, cross-shop denial, injected database outage, durable
  budget across sessions and 11 concurrent requests admitting exactly 10.
- Browser partial PASS: a disposable synthetic probe (since removed during
  repository cleanup) served isolated synthetic PostgreSQL records on loopback
  port 8017. Confirmed
  filter downloaded `order-summaries.csv`; inspected its real contents for quoted
  multiline/formula-safe buyer fields and 12000/2000/1500/10000/10500 BDT balances.
  Empty pending filter displayed explicit empty feedback. Order detail showed
  accepted advance 1500 and actual COD 10500 consistently; copy displayed success.
  This remains historical evidence; current coverage is the maintained API and
  `OrderExport.test.tsx` suites.
- Browser BLOCKED: the automation bridge's virtual clipboard returned empty after
  the real Clipboard API reported success, so pasted contents are unverified.
  Spreadsheet-application import/readability is NOT RUN. These are acceptance
  gaps, not passing checks. Hosted authentication/providers/deployment NOT RUN.
- Two-axis code review: Standards found no documented violations, one nonblocking
  data-clump concern in the projection helper; Spec found no actionable code
  violations and called out the browser acceptance gaps. Its suggested concurrent
  admission test was added and passed.
- Browser regression fixed: changing lifecycle filter now resets export feedback;
  a React regression test and final production-browser check confirm that empty
  pending-export feedback disappears when switching back to confirmed orders.
  Screenshot: `.cache/order-export-browser-proof.png`.
- Final root gate PASS: `npm run check`, all eight stages, fresh artifact
  `.cache/checks/check-Tc4YxS/result.json`. `git diff --check` PASS.
- Next action after commit: verify copied text and CSV import in an actual
  spreadsheet/browser clipboard environment. Do not mark those gates passed from
  the download/success-message checks. No hosted migration or deployment occurred.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

