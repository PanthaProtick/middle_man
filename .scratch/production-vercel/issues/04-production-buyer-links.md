# 04: Production buyer-link workflow

**What to build:** An explicitly enabled production buyer-link policy permits public order terms/status and initial submission while preserving seller authority and private-data boundaries.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Add a default-disabled production policy separate from local self-test policy; accept only the documented link-possession policy and reject unknown settings.
- [x] Allowed link possession grants public terms/status and permitted initial submission, without claiming buyer identity or granting seller actions, private evidence access, or unrestricted corrections.
- [x] Preserve expiry, revocation, reissue, projection, initial submission, and existing correction rules. Submitted-order status access is not incorrectly ended by the initial submission deadline.
- [x] Reissue invalidates the old link without changing the original deadline, submission state, or payment allocation; predecessor links never disclose replacements.
- [x] HTTP contract tests cover disabled and enabled production policy, invalid settings, invalid/expired/revoked links, private access rejection, and duplicate-safe submission retries, including authority checks before cached replay.
- [x] Preserve bounded requests, actionable failures, and offline test operation; do not enable real courier booking or paid AI.
- [x] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact. Hosted browser acceptance belongs to ticket 09.


## Implementation and verification — 2026-11-04

- Added `PRODUCTION_BUYER_ACCESS_POLICY`: empty disables access; only
  `link_possession` enables the gate in production. Unknown settings fail validation.
  The local self-test policy remains separate. No lifecycle/service rewrite was needed.
- Changed backend config/gate, offline test-environment isolation, policy HTTP tests,
  new `backend/tests/test_production_buyer_links.py`, backend environment example,
  and `docs/contracts/buyer-access-and-corrections.md`.
- Real-gate HTTP tests cover public projection/privacy, seller authority rejection,
  duplicate-safe retries, expiry, status after deadline, reissue and revocation
  before replay. Existing allocation and bounded-admission regression tests pass.
- TDD: enabled-production public projection failed with 503 before implementation;
  it passed afterward. Focused command:
  `npm run test:backend -- tests/test_production_buyer_links.py tests/test_public_access_policy.py tests/test_link_reissue.py tests/test_link_revocation.py tests/test_public_admission.py`
  — 42 passed. `npm run typecheck` passed.
- Two-axis code review against base `98bdccd744062df719d80ea99a359dc90b1ad137`:
  Standards 0 findings; Spec 0 findings.
- Initial root check caught import ordering (fixed). Next run encountered Windows
  pytest temporary-directory permissions: 745 passed, 187 skipped, 3 setup errors.
- Final gate: `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-buyer-policy-final`
  with `npm run check` — PASS. Backend 748 passed / 187 skipped; frontend
  126 files / 685 tests passed; tooling, conventions, lint, types, build and HTTP
  smoke passed. Fresh artifact: `.cache/checks/check-jA2M3c/result.json`.
- No remote database, deployment or provider calls. PostgreSQL integration remains
  skipped; hosted browser acceptance remains ticket 09. Deployment-wide ingress
  protection remains separate from the per-worker request limiter.
- Next action: continue the production hosting tickets; verify hosted acceptance
  before inviting real buyers.
