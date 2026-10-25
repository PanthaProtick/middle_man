# 07: Open a buyer link with a safe public projection

**What to build:** Create an order as a verified seller and open its buyer link to view only approved public terms and status.

**Blocked by:** 02: Separate saved-link encryption from Clerk credentials; 04: Sign in and open the owning shop.

**Status:** completed

## Acceptance criteria

- [x] Explicit self-test policy enables legitimate token possession without buyer sign-in/OTP; unset policy and invalid tokens remain denied.
- [x] Public responses contain approved terms/status only, excluding buyer personal data, screenshots, raw receipts, internal review reasons and private replacement information.
- [x] Private/no-store and referrer protections apply and application logs do not record complete bearer links or personal request bodies; seller-only routes retain their authority checks.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Order creation/link retrieval, public policy dependency, public projection and buyer page loading.

## Verification target

Exercise seller-create to public-read via API and buyer loading UI; assert response allowlist, invalid/unconfigured policy cases and security headers.

Coverage: AC04, AC44, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Submission mutation changes, revocation/reissue and admission limits, which have separate tickets.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

### 2026-10-25 implementation evidence

- Added explicit `PUBLIC_BUYER_ACCESS_POLICY=self_test_link_possession`, requiring
  self-test mode and development/test environment. Unset policy remains denied;
  service token checks and seller authorization are preserved.
- Kept the existing allowlisted projection and privacy/referrer headers. Public
  validation errors no longer echo personal inputs through detail/custom messages.
  Supported launch commands disable access logging; direct-launch requirements
  are documented. No credentials or real environment files were changed.
- API seam: locally signed seller token through the real verifier, seller-create,
  anonymous public-read, invalid token, denied policy matrix, pending projection
  after synthetic personal submission, and public validation privacy. Persistence
  uses the offline adapter with independently isolated gate settings; this does
  not establish durable self-test or live Clerk/Neon acceptance.
- Red/green: enabled public-read initially failed 503, then passed. Validation
  privacy initially exposed body inputs, then exposed a custom phone error;
  both leaks now have a passing regression.
- Focused backend: `npm run test:backend -- tests/test_public_access_policy.py
  tests/test_public_order_routes.py` — PASS, 13 tests.
- Buyer UI: `npm run test:frontend -- src/features/buyer/BuyerPortal.test.tsx
  src/features/buyer/BuyerRefresh.test.tsx` — PASS, 19 tests; includes no-auth,
  no-store fetch and existing loading/policy/failure/status cases.
- `npm run typecheck` — PASS (backend strict types and frontend TypeScript).
- Independent code-review skill: Standards 0 findings; Spec 0 findings.
- First pre-commit `npm run check` stopped at Ruff import ordering in the new
  test (`.cache/checks/check-GXxIRK/result.json`); import order corrected.
  Final root verification retry PASS: `.cache/checks/check-qsMUiR/result.json`.
  All eight stages passed: tooling tests, backend lint/types/tests, frontend
  lint/tests/build and HTTP smoke. Backend: 315 passed, 67 skipped (optional
  PostgreSQL integration cases); frontend: 133 passed across 29 files.
- Real-session browser and live Clerk/Neon journey: NOT RUN; owned by subsequent
  acceptance tickets. No hosted/proxy logging verification or deployment performed.
