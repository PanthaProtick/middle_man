# 03: Production seller sessions and shop isolation

**What to build:** Sellers use production Clerk sessions to access only their own shop, with consistent frontend and API authentication configuration and explicit rejection of unauthorized access.

**Blocked by:** None (can start immediately).

**Status:** implemented — local verification passed; hosted acceptance remains ticket 09

- [x] Trace and preserve the seller sign-in/out and authenticated request flow; production requests enforce cryptographic session verification and shop authorization.
- [x] Reject invalid or expired sessions, incompatible issuer or authorized-party configuration, development credentials, and identity overrides in production.
- [x] Contract tests cover two sellers and cross-shop reads and writes; possession of another shop or order identifier does not grant access.
- [x] Document matching frontend/API Clerk production configuration, exact trusted origins, and sign-in/out acceptance steps without exposing backend secrets in public variables.
- [x] Do not introduce a webhook based solely on example configuration; add one only if an implemented workflow requires it.
- [x] Keep automated tests offline with existing external seams; clearly separate those results from real hosted Clerk acceptance in ticket 09.
- [x] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact.

## Implementation evidence — 2026-11-04

- Base: `f9ca379eff3a286bda139ed92bb1e4842cf7dba0`; current branch `main`.
- User confirmed HTTP API contracts and public production configuration validation
  as test seams. Existing cryptographic verifier, shop derivation, session renewal,
  sign-out clearing, and signed two-seller private-surface tests remain intact.
- `backend/app/core/session_trust.py` and `readiness.py`: require an exact HTTPS
  authorized party matching CORS; reject malformed origins, localhost, wildcard
  trust, and development issuers, including uppercase hostnames. One authorized
  party remains the explicit contract; multiple CORS entries do not broaden it.
- `frontend/src/Root.tsx` and seller `sessionConfiguration.ts`: production seller
  entry rejects absent/development publishable keys; local development and public
  buyer links retain credential-free paths. Clerk itself validates key contents.
- Tests: added `test_production_seller_config.py`,
  `test_production_seller_sessions.py`, and `sessionConfiguration.test.ts`;
  adjusted valid production fixtures in `test_production_readiness.py`.
- Both `.env.example` files, `docs/production-secrets.md`, and
  `docs/production-seller-sessions.md` explain matching settings, secret scopes,
  no webhook workflow, canonical origins, and hosted acceptance steps.

### Checks and review

- Red: new configuration regressions initially produced 8 failures / 1 pass.
- `npm run test:backend -- tests/test_production_seller_config.py tests/test_production_readiness.py`:
  17 passed, including after consolidating the development-issuer restriction.
- `npm run test:backend -- tests/test_production_seller_sessions.py tests/test_seller_auth_integration.py tests/test_shop_isolation.py tests/test_clerk_auth.py tests/test_clerk_clock_skew.py`:
  42 passed, offline signatures/JWKS boundary only.
- `npm run test:frontend -- src/features/seller/sessionConfiguration.test.ts src/Root.test.tsx src/features/seller/SellerSession.test.tsx src/features/seller/sessionRequest.test.ts`:
  40 passed. `npm run typecheck` passed twice; conventions passed.
- Code-review skill: separate Standards and Spec agents reviewed the staged diff
  against the base. Standards: no violations, one nonblocking duplicate issuer
  check consolidated afterward and focused tests rerun. Spec: no findings.
- First root check: `.cache/checks/check-1r82LK/result.json` failed due to Windows
  system-temp fixture permissions (734 passed, 187 skipped, 3 setup errors).
- Final `npm run check` with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-seller-sessions-20261104`:
  **PASS**, `.cache/checks/check-2eRJ2G/result.json`. All stages passed;
  backend 737 passed / 187 skipped, frontend 126 files / 685 tests passed.

### Remaining acceptance and limits

- Hosted Clerk sign-in/out, account switching/in-flight browser behavior, actual
  production key/domain alignment, PostgreSQL isolation, and deployment are **not
  run** here. Next action: ticket 09 hosted acceptance with two synthetic sellers.
- Local sign-out clears access; copied JWTs may remain usable until expiry.
  Static PEM rotation requires operator updates; JWKS keys cache per process.
  No webhook or immediate server-side session revocation was introduced.
