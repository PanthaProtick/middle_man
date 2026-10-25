# 04: Sign in and open the owning shop

**What to build:** Sign in through Clerk and open a workspace whose shop ownership comes from the verified session.

**Blocked by:** 01: Fail explicitly when durable storage is unavailable.

**Status:** implementation complete; real Clerk-session acceptance pending

## Acceptance criteria

- [ ] The integration path obtains a real session token and uses verified identity to create/read only its owning shop; no default mock token grants access. Code and offline evidence pass; real Clerk-session journey remains unrun.
- [x] Verification checks signature, expiry, trusted issuer and applicable audience/authorized-party constraints; key discovery uses trusted configuration and handles key refresh.
- [x] Invalid credentials yield typed 401 responses and unavailable verification yields an explicit 503 without private data; offline tests inject a bounded verifier seam.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Decisions & Implementation

### 2026-10-25 follow-up (supersedes the original completion claims)

Base commit: `6ff56cd7a56897b1404320b001639f9f7a66bb82`. The original
implementation still signed in with `dev-pilot_seller` and persisted the token in
localStorage. It did not obtain a real Clerk session.

- Added pinned `@clerk/react`, conditional `ClerkProvider` bootstrap and
  `features/seller/SellerSession.tsx`. Clerk owns sign-in/out and persistence;
  bearer tokens stay in application memory and refresh every 30 seconds. Missing
  frontend configuration shows an explicit unavailable state. Public buyer routes
  bypass Clerk. Session changes/sign-out remount the workspace to discard private
  state and outstanding UI updates.
- `App.tsx` accepts the SDK-acquired credential; removed localStorage token reads
  and writes. The workspace sign-in callback no longer fabricates a credential.
- Backend auth wires `CLERK_AUTHORIZED_PARTY`/`CLERK_AUDIENCE`, requires a trusted
  issuer in the application factory, maps invalid verifier configuration to 503,
  and rejects both dev/mock tokens in durable mode. Storage tests inject a bounded
  identity dependency instead of depending on a durable-mode authentication bypass.
- Verifier rejects non-object JWT JSON, invalid key identifiers, malformed or
  non-finite expiry/not-before claims and tokens at the exact expiration boundary.
  Issuer comparisons are exact. Existing signature/key-refresh behavior is retained.
- Updated environment examples and offline input clearing in `tests/conftest.py`
  and `scripts/smoke.py`; no real environment files were read or changed.

Verification:

- Confirmed red regressions before fixes for fabricated sign-in credentials,
  malformed/time-bound JWT claims, durable dev tokens and invalid verifier config.
- Focused frontend: session/workspace tests, 13 passed. Focused verifier: 15 passed.
  Focused API auth: 9 passed. Durable storage regression suite: 15 passed.
- `npm run typecheck`: PASS (both applications).
- First root check stopped on import sorting in `tests/conftest.py`; corrected.
- Final root `npm run check`: PASS across all eight stages;
  303 backend tests passed, 67 skipped; 119 frontend tests passed;
  `.cache/checks/check-Zt0oEn/result.json`.
- Local browser: visually verified signed-out/unconfigured seller page at
  `http://localhost:5173/`, disabled sign-in and explicit configuration message;
  no private workspace shown. Owned dev server stopped afterward.
- NOT RUN: a real Clerk-session sign-in/create/read/sign-out journey and live
  provider/durable database acceptance. SDK-boundary doubles and signed synthetic
  tokens establish offline behavior only. Ticket 20 retains broader browser flow.

Review: independent code-review axes completed against base `6ff56cd`: Standards
0 findings; Spec 1 evidence gap (real Clerk-session journey), no code defect or
scope creep. No implementation edits followed the passing root gate.

Next action: commit the reviewed implementation. To close
the remaining acceptance gap, run the owning-shop journey using an owner-controlled
Clerk test session and record dated evidence here.

1. **Backend Token Verifier (`app.core.clerk_verifier.ClerkTokenVerifier`):**
   - Implemented RS256 token decoding and verification using Python `cryptography` library without adding unpinned dependencies.
   - Verified RS256 signature, expiry (`exp`), trusted issuer (`iss` matching `settings.CLERK_ISSUER`), and `azp`/`aud` claims.
   - Key discovery strictly fetches JWKS from `f"{settings.CLERK_ISSUER}/.well-known/jwks.json"` (never from untrusted token headers). Supports static PEM keys via `settings.CLERK_JWT_KEY`.
   - Unknown `kid` triggers JWKS cache refresh; network unreachable during refresh raises typed 503 `AuthenticationUnavailableError`.
   - Tampered signature, expired tokens, or issuer mismatch raise typed 401 `AuthenticationError`.

2. **Backend Authentication & Route Seam (`app.core.auth.get_seller_identity`):**
   - `mock-seller-token` is unconditionally rejected with 401 `UNAUTHORIZED` in durable / self-test integration mode.
   - When verifier is configured (integration path), `dev-*` and mock tokens are strictly forbidden; real RS256 tokens are verified and `sub` identity is extracted.
   - In offline unit testing without configured verifier, `dev-*` tokens provide offline standby identity to retain backwards-compatible assertions (AC50, Ticket 01 tests).
   - Shop read and creation endpoints (`/api/seller/shop`) isolate data completely per seller `sub`.

3. **Frontend Seller Workspace & Auth Lifecycle (`SellerWorkspace`, `App`, `Header`):**
   - Removed hardcoded `mock-seller-token` default prop from `SellerWorkspace`.
   - When unauthenticated (`!token`), workspace renders an explicit sign-in prompt and suppresses all background fetching.
   - When authenticated, workspace loads shop, accounts, orders, and transactions for the authenticated token.
   - When signed out, workspace clears all private data.
   - Header shows authenticated state with clean sign-out action.

## Verification Evidence

1. **Focused Backend Verifier Tests:**
   `npm run test:backend -- tests/test_clerk_auth.py`
   7 passed in 0.45s:
   - `test_verify_valid_token_returns_seller_identity`
   - `test_verify_valid_token_with_jwt_key_pem`
   - `test_expired_token_raises_authentication_error`
   - `test_issuer_mismatch_raises_authentication_error`
   - `test_tampered_signature_raises_authentication_error`
   - `test_network_failure_on_key_refresh_raises_authentication_unavailable`
   - `test_key_refresh_discovers_new_key_and_verifies_token`

2. **Focused Integration Tests:**
   `npm run test:backend -- tests/test_seller_auth_integration.py`
   5 passed in 0.31s:
   - `test_durable_mode_rejects_mock_token`
   - `test_dev_and_mock_tokens_rejected_when_verifier_configured`
   - `test_unavailable_verifier_returns_503`
   - `test_invalid_or_expired_real_token_returns_401`
   - `test_real_token_creates_and_reads_owning_shop_with_isolation`

3. **Focused Frontend Tests:**
   `npm run test:frontend -- src/features/seller/SellerWorkspace.test.tsx`
   10 passed in 0.46s (including unauthenticated state and sign-in/sign-out state clearing).

4. **Full Pre-Handoff Verification Gate:**
   `npm run check`
   - Tooling tests: PASS
   - Backend lint: PASS (ruff clean)
   - Backend types: PASS (mypy 87 files clean)
   - Backend tests: PASS (291 passed, 67 skipped)
   - Frontend lint: PASS (oxlint 0 warnings, 0 errors)
   - Frontend test: PASS (26 files, 116 passed)
   - Frontend build: PASS
   - HTTP smoke: PASS
   Verification result: `.cache/checks/check-Pe34ug/result.json`

## Bounded context

### 2026-10-25 Ticket 20 sign-in regression repair

`SellerSession` treated `failure?.sessionId === sessionId` as a failure when both were absent during Clerk initialization. It also rendered the unconfigured-Clerk workspace while the configured SDK was still loading. Require an actual failure record and show a loading status until Clerk loads. `SellerSession.test.tsx` covers loading, absent signed-out session and real sign-in callback alongside existing session-loss regressions (11 PASS); `npm run typecheck`: PASS.

Actual local in-app browser at `http://localhost:5173/`: observed `Loading seller sign-in…`, then an enabled Sign in button; clicking opened the real Clerk `Sign in to MiddleMan` dialog with email and Google options, marked Development mode. No credentials entered and no identity authenticated. This supersedes the disabled-button diagnosis in Ticket 20; two-identity authentication/ownership acceptance remains pending. Full gate runs via final commit hook; exact result is reported in the handoff.

Read the shared ticket index and only the relevant specification sections first.
Then trace: Seller application entry, token acquisition, shared backend identity verification and shop setup/read contracts.

## Verification target

Add API-level signed-token and trusted-key refresh tests plus a feature sign-in/workspace test. Record one real Clerk-session shop journey separately from offline checks.

Coverage: AC01, initial AC02, AC50. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Full cross-surface permission matrix, session-loss UI hardening and public buyer access.
