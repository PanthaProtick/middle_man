# 16: Refresh pending status reliably

**What to build:** A buyer refreshes a pending order manually or watches it reach a final status without runaway polling or stale responses.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md); [11: Cancel, reject or replace an order](11-order-outcomes-replacement.md)

**Status:** implemented; native browser lifecycle acceptance pending

## Acceptance criteria

- [x] Reuse existing durable public status and privacy projection; basic pending/confirmed/terminal views must already work without this enhancement.
- [x] Poll pending status every 30 seconds only while visible; support manual refresh and bounded backoff for transient errors/rate limits.
- [x] Stop on terminal outcome, retained-record unavailability, hidden/unmounted page or request cancellation; resume visibility appropriately without duplicate loops.
- [x] Ignore out-of-order responses so confirmed/cancelled/rejected/expired views cannot regress to pending; do not fabricate success from a cache.
- [x] Show loading, offline/unavailable and safe retry states without revealing private receipt/review/personal details; retain the live public-policy gate.
- [x] Render actual accepted COD on confirmation, contact-seller guidance on stopped orders and nonexpiry for submitted pending orders.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC33, AC34, AC35, AC37, AC44, AC45, AC46, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

Frontend fake-clock/network-order/unmount tests, API projection regressions and actual browser visibility/offline/manual-refresh/terminal-stop flows. Fake timers alone do not establish browser lifecycle behavior.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.


## Implementation and verification — 2026-10-24

- Reused the durable typed public GET, privacy projection, default-deny live public gate and existing no-store response headers. No schema or backend production behavior change was needed.
- Added `frontend/src/features/buyer/usePublicOrder.ts`: one serialized read controller, completion-based 30-second pending polling, 15-second request timeout, bounded 60/120/240/300-second transient/429 backoff, manual retry, visibility/offline cancellation and reconnection resume, generation-based stale-response rejection, terminal/unavailable stop and safe messages. Public GET sends AbortSignal and `cache: no-store`.
- A newer policy denial or unavailable record clears displayed data and prevents a late submission result from reopening it. Token changes remount the session and discard previous order/input. No browser cache is used to invent an outcome.
- Integrated through `BuyerPortal.tsx`, preserving recoverable form edits and existing submission/idempotency behavior. `BuyerOrderDetails.tsx` limits the expiry notice to unsubmitted links. `BuyerStatusView.tsx` explains submitted nonexpiry and shows accepted advance plus actual COD on confirmation; stopped orders retain seller contact guidance.
- Added `BuyerRefresh.test.tsx` (13 React/network/timer lifecycle cases) and `backend/tests/test_pending_status_refresh.py` (durable public reads across new connections, elapsed expiry, privacy, no-store and seller cancellation). Test seams were explicitly approved by the user. Observed RED/GREEN for hidden polling, pending expiry copy and the late-submission/policy-denial regression.
- Focused frontend PASS: `npm run test:frontend -- src/features/buyer/BuyerRefresh.test.tsx src/features/buyer/BuyerPortal.test.tsx src/features/buyer/BuyerRetry.test.tsx` (22 tests); earlier API-client-inclusive focused run passed 29 tests before the additional denial regression. `npm run typecheck` and `npm run lint:frontend` PASS after the final source edit.
- Focused API PASS: `npm run test:backend -- tests/test_pending_status_refresh.py tests/test_public_order_routes.py tests/test_buyer_boundaries.py tests/test_order_outcomes_postgres.py` (17 tests).
- Real PostgreSQL PASS: verified loopback `127.0.0.1:55447`, database `postgres`, data directory `E:/middle_man/.cache/resolution-pg` before disposable schema operations. No hosted database was used.
- Actual browser PARTIAL PASS: production React build on isolated synthetic PostgreSQL harness, pending nonexpiry, manual refresh loading/disabled state, injected transport outage with last-status warning, manual retry recovery and seller cancellation/contact guidance without resubmission/refresh controls. Evidence: `.cache/pending-refresh-browser-proof.png`. Owned server and synthetic browser schema removed afterward.
- Native browser visibility/offline transitions and observed timed terminal-stop: NOT RUN. Available browser controls do not provide native offline emulation or request instrumentation; React lifecycle tests cover those behaviors, but do not prove native browser lifecycle acceptance. This ticket remains open for those explicit acceptance checks.
- Configured live providers/auth/deployment: NOT RUN; no live rollout authorized. Existing public policy/retention/storage/rate-limit/backup launch gates remain binding.
- Independent code-review: Standards 0 actionable findings. Spec found 1 policy-denial/submission ordering bug; reproduced, fixed with regression and independently re-reviewed as resolved (0 remaining code findings). Review baseline: starting commit `435d6fac97a22d36fe1fe001f5281eb6608dcff7`.
- First root gate `.cache/checks/check-TQ4N59/result.json`: FAIL on frontend lint after 259 backend tests passed; removed the cascading form-default effect and reran focused checks. Final gate result is recorded below.
- Next action: complete native browser hide/show and offline/reconnect plus observed terminal-stop acceptance; then close the remaining verification gap. No deployment or policy selection is implied by local success.
- Final root gate: PASS `npm run check` with disposable PostgreSQL enabled; all 8 stages, 259 backend tests, 96 frontend tests across 20 files, strict types/lint, production build and HTTP smoke. Fresh result: `.cache/checks/check-cShI4x/result.json`.
