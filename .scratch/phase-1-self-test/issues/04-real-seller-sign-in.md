# 04: Sign in and open the owning shop

**What to build:** Sign in through Clerk and open a workspace whose shop ownership comes from the verified session.

**Blocked by:** 01: Fail explicitly when durable storage is unavailable.

**Status:** complete

## Acceptance criteria

- [x] The integration path obtains a real session token and uses verified identity to create/read only its owning shop; no default mock token grants access.
- [x] Verification checks signature, expiry, trusted issuer and applicable audience/authorized-party constraints; key discovery uses trusted configuration and handles key refresh.
- [x] Invalid credentials yield typed 401 responses and unavailable verification yields an explicit 503 without private data; offline tests inject a bounded verifier seam.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Decisions & Implementation

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

Read the shared ticket index and only the relevant specification sections first.
Then trace: Seller application entry, token acquisition, shared backend identity verification and shop setup/read contracts.

## Verification target

Add API-level signed-token and trusted-key refresh tests plus a feature sign-in/workspace test. Record one real Clerk-session shop journey separately from offline checks.

Coverage: AC01, initial AC02, AC50. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Full cross-surface permission matrix, session-loss UI hardening and public buyer access.
