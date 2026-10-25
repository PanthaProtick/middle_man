# 08: Submit once and recover an uncertain response

**What to build:** Complete manual buyer submission, recover uncertain outcomes with the original mutation key and continue viewing submitted-order status.

**Blocked by:** 06: Disable AI while preserving manual entry; 07: Open a buyer link with a safe public projection.

**Status:** done

## Acceptance criteria

- [x] A valid manual submission supports different contact/sender numbers and commits once; invalid input or same-key changed payload cannot partially write.
- [x] Controlled-time tests enforce the original 48-hour initial deadline, including a draft opened earlier; submitted pending orders remain pending and viewable afterward.
- [x] A lost response is resolved with the original key/refetch; duplicate/new submissions and buyer corrections are rejected while legitimate original-operation replay returns the durable outcome.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Buyer submission API/service, mutation-key handling, submission form and status/retry hooks.

## Verification target

Focused API boundary/idempotency tests, PostgreSQL commit/retry evidence and buyer retry/status feature tests; keep original validation assertions.

Coverage: AC05, AC07–AC09, AC28, AC31–AC33, AC37–AC38. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

AI activation, screenshots, token rotation and payment-match policy changes.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

### 2026-10-25 implementation and verification

- Traced buyer API/service, aggregate locks, atomic replay-record commit, expiry,
  projection, form and retry/status hooks. Existing server behavior already
  enforces single submission, separate contact/sender numbers and seller-only
  corrections. No matching or token-lifecycle changes were needed.
- Fixed unbounded client waits: submission and recovery status JSON requests each
  abort after 15 seconds. Polling retains its supplied cancellation. Client abort
  remains an unknown outcome; retry uses the original frozen payload and key.
  Timers clear on completion.
- Red/green: hanging POST and recovery GET previously kept submission disabled;
  the regression now permits same-key retry and shows only a server acknowledgement.
- Added PostgreSQL cases for opened draft crossing original 48-hour deadline,
  pending status/original replay after deadline, invalid input without partial
  writes or consumed key, and anonymous/buyer-token correction rejection.
  Preserved race, rollback, changed-payload, normalization and reconnection tests.
- Verified disposable PostgreSQL 18 via SQL before schema operations: database
  postgres, 127.0.0.1:55447, data E:/middle_man/.cache/resolution-pg. Tests create
  isolated temporary schemas. No Neon or persistent manual dataset was accessed.
- Focused backend PASS: npm run test:backend -- tests/test_public_order_routes.py
  tests/test_buyer_boundaries.py tests/test_buyer_postgres_boundaries.py
  tests/test_buyer_postgres_transactions.py tests/test_buyer_corrections.py
  (42 tests). After adding correction denial, transaction file PASS (7 tests).
  Both runs enabled BUYER_TEST_POSTGRES_URL for the verified disposable target.
- Focused frontend PASS: npm run test:frontend --
  src/features/buyer/BuyerPortal.test.tsx src/features/buyer/BuyerRetry.test.tsx
  src/features/buyer/BuyerRefresh.test.tsx src/features/buyer/api.test.ts
  (31 tests). npm run typecheck PASS twice.
- Changed code: frontend/src/features/buyer/{api.ts,BuyerRetry.test.tsx};
  backend/tests/{test_buyer_postgres_boundaries.py,test_buyer_postgres_transactions.py}.
- Independent code-review skill: Standards 0 findings; Spec 0 findings against
  starting commit a64e2dd39c694329e66d410a3629e53285cd4fd6.
- Real-browser/mobile and live Clerk/Neon acceptance NOT RUN; real-session
  journeys remain with tickets 20-21. Component/local PostgreSQL evidence does
  not establish hosted acceptance or the complete synthetic self-test.
- Final root gate PASS with disposable PostgreSQL enabled: `npm run check`, all
  eight stages; backend 386 passed (no skips), frontend 134 passed across 29 files.
  Evidence: `.cache/checks/check-TeApBF/result.json`.
