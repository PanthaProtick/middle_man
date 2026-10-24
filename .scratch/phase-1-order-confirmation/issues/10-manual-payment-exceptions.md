# 10: Accept payment exceptions with a COD preview

**What to build:** A seller reviews an eligible payment exception and explicitly accepts the actual received advance after seeing the resulting COD balance.

**Blocked by:** [07: Resolve conflicting evidence and competing claims](07-resolve-evidence-conflicts.md)

**Status:** resolved

## Acceptance criteria

- [x] Require an existing same-shop seller receipt, expected version and nonblank reason; show provider/account/sender/time/amount discrepancies and record any accepted exceptions.
- [x] Preview total minus actual received amount. Accept positive actual amounts at most the total; never allow a typed smaller allocation to hide an excessive payment or split a receipt.
- [x] Under/over-advance acceptance records actual amount and manual basis, then displays matching balances on seller detail and buyer confirmation.
- [x] Use the existing atomic allocator, ownership checks and used markers; manual decisions cannot bypass single use, unresolved receipt evidence or another committed allocation.
- [x] Payments exceeding the entire total stay unresolved for external handling; do not create refunds, credit, partial allocations or payment-reassignment endpoints.
- [x] Extend version/idempotency and concurrency handling to manual-versus-automatic/manual decisions; retain audit and privacy-safe exception aggregates.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC13, AC14, AC15, AC20, AC21, AC22, AC24, AC25, AC26, AC37, AC38, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API negative/positive exception and cap tests; real PostgreSQL manual-versus-automatic/manual contention; browser amount-preview approval and excessive-payment refusal.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.



## Implementation record - 2026-10-24

- Implemented same-shop typed payment preview and explicit full-receipt confirmation.
  Order and receipt versions bind the approval to the reviewed evidence; reason and
  mutation key are required. Positive actual amounts through the entire total are
  accepted, with manual basis and actual COD on seller detail and buyer confirmation.
  Excessive payments and attempted smaller allocations remain unresolved.
- Automatic and manual decisions share allocation writes, shop-first locking,
  retained-identity used markers and order/receipt uniqueness. Unresolved evidence,
  competing or held claims, wrong transaction identity, used receipts and stale
  previews cannot be overridden. Serialization retries restart the whole decision.
- Structured private decision history retains actor, reason, accepted amount, COD
  and exception codes. Migration 0010 adds anonymous shop counters, backfilled from
  existing allocations and incremented in the same transaction without replay counts.
  Schema migration was applied only to unique disposable loopback test schemas.
- Seller detail integrates receipt selection, discrepancy comparison, immutable
  amount preview, validation, loading, permission/failure messages, stale refresh,
  exact-key unknown-outcome retry and committed history/totals. Buyer correction
  state refreshes after confirmation so payment fields become visibly locked.
- Changed paths: payment decision/metrics models; allocation, preview, decision and
  history services; seller order routes and reconciliation adapters; migration 0010;
  API/PostgreSQL tests; seller PaymentException/PaymentHistory components, typed
  client and tests; detail integration; architecture and API references.

### Verification

- Public seams agreed: FastAPI endpoints, React seller flow and the existing
  disposable PostgreSQL harness; browser acceptance checked separately.
- TDD: first API test failed with missing preview route (404), then passed;
  initial frontend test failed with missing approval component, then passed.
- Focused API: PASS, 17 tests (amount bounds, overpayment/split refusal, strict input,
  ownership/auth/key, stale versions, evidence/claim holds, provider/account/sender/
  time exceptions, replay, history and private aggregate counts).
- Disposable PostgreSQL: PASS, 5 focused tests, plus existing PostgreSQL suites in
  the full gate. Independent connections prove manual/manual, same-key and manual/
  automatic serialization; failure at idempotency persistence rolls back allocation,
  markers and counters; refetch/replay remains durable after memory reset.
  Verified PostgreSQL 18 target: 127.0.0.1:55447, database postgres, data directory
  E:/middle_man/.cache/resolution-pg; each fixture creates/drops its own unique schema.
- Frontend focused: PASS, 4 tests covering amount preview, exact payload/key retry,
  unknown-outcome input lock, overpayment refusal, permission failure and retained
  decision history/aggregate display. Typechecking and lint: PASS.
- Root npm run check: PASS, all eight stages, 185 backend and 57 frontend tests,
  including real PostgreSQL with BUYER_TEST_POSTGRES_URL explicitly set.
  Fresh result: .cache/checks/check-fjZUle/result.json.
- Browser: PASS, built React served on 127.0.0.1:8013 with disposable PostgreSQL and
  explicit synthetic seller/public adapters. BDT 1500 actual acceptance against
  BDT 12000 total produced BDT 10500 COD on both views; seller retained manual basis,
  exceptions, reason, seller/time and totals. A BDT 12000.01 receipt stayed blocked
  even with a reason, without a smaller editable allocation. Evidence:
  .cache/payment-acceptance/seller-confirmed.png, excessive-refused.png, buyer-confirmed.png.
- Two-axis code review against starting HEAD 11d07c534e504eb50fef9149e2f720b0e81ac8b7:
  Standards: 0 hard findings; optional positional-counter smell fixed with named
  PaymentSummary fields. Spec: 2 initial findings (history and anonymous counters),
  both fixed and re-reviewed; no remaining actionable findings.
- Configured/live Clerk/payment providers, hosted database migration and deployment:
  NOT RUN. Public-access, retention/deletion and remaining launch gates still apply.
  No deployment, real-data pilot, refund or payment reassignment was performed.
- Next action: implement Ticket 11 within its approved boundaries; apply reviewed
  migration 0010 only through a separately authorized hosted migration workflow.
