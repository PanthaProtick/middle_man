# 09: Hosted acceptance and operator handoff

**What to build:** The owner receives a complete deployment and recovery runbook plus evidence that distinguishes code readiness, successful deployment, hosted acceptance, and authorization to invite real users.

**Blocked by:** 02: Fail-closed production readiness; 06: Durable workflows across backend instances; 07: Deployment-wide public admission protection; 08: Authenticated scheduled retention.

**Status:** ready-for-agent

- [ ] Consolidate configuration scopes, owner-supplied decisions, domain/DNS and Clerk setup, database target verification, initialization order, deployment steps, and health checks into an operator runbook.
- [ ] Specify stable-secret backup and rotation consequences, rollback schema compatibility, and recovery steps; distinguish application rollback from data restoration.
- [ ] Before remote changes, obtain explicit authorization for the actual targets and actions. Earlier spec or ticket approval does not authorize deploying, applying remote migrations, purchasing services, or collecting customer data.
- [ ] After authorized setup, perform hosted acceptance with real Clerk sessions and isolated synthetic data: sign-in/out, two-seller isolation, order creation, direct buyer navigation and refresh, buyer submission, seller review, and persistence across instances.
- [ ] Verify hosted expiry/revocation, private access rejection, deployed ingress protection, scheduled maintenance, and observable failure/recovery behavior.
- [ ] Keep real Pathao booking disabled unless separately opted in. Optional AI and live-provider acceptance remain separate from core hosting acceptance, with manual workflows preserved.
- [ ] Record local, disposable PostgreSQL, hosted browser/runtime, and live-provider results separately, with reproducible evidence and explicit failed, blocked, or unrun gates. Deployment success alone does not satisfy acceptance.
- [ ] Run final root `npm run check` for any code/tooling changes and record its fresh artifact; record the applicable documentation checks for a documentation-only handoff.
- [ ] State whether public launch gates are satisfied; do not mark hosted acceptance complete or invite real users while required evidence or authorization is missing.

## Hosted seller routing correction — 2026-11-04

- Browser evidence: health reached the backend, but the signed-in shop request
  reached the frontend domain at `/api/seller/shop`, returning its cached SPA
  response. This explains the workspace error and absence of backend request logs.
- Traced the transport: health used the configured API base, while seller,
  buyer, and buyer location requests used relative paths. Added a shared API URL
  resolver at those transport boundaries, including seller refresh retries and
  binary exports; retained the local proxy behavior when no base is configured.
- Regression coverage exercises configured-base shop reads and token refresh,
  buyer reads/submissions, location lookups, health, query/encoding preservation,
  invalid destinations, and local proxy behavior. Test setup isolates request
  routing from local build environment values.
- Focused verification: 6 test files / 44 tests passed. Courier-location fixtures
  now use the real API path shape instead of `/review`; all existing assertions
  remain. Follow-up routing/location run: 3 files / 17 tests passed.
- Initial root gate failed on three Windows pytest temp-directory permission
  errors; a repository-local base temp fixes that environment issue. Next root
  run caught the non-API courier test fixture, corrected above.
- Final `npm run check` PASS with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-hosted-routing-final`.
  Result: `.cache/checks/check-fIGTGi/result.json`. Tooling, conventions, backend
  lint/types/tests, frontend lint/tests/build, and HTTP smoke passed. PostgreSQL
  and live-provider acceptance were not exercised by this routing fix.
- Hosted acceptance remains open: deploy the corrected frontend, verify its shop
  request reaches the API, then complete sign-in and synthetic shop setup. No
  remote deployment, provider call, or real booking was performed by this fix.

## Review follow-up — 2026-11-04

- Exposed `X-Export-Count` through backend CORS so hosted empty exports retain
  their existing no-matches feedback. Regression coverage sends allowed-origin
  export requests for both zero and one matching order and verifies the exposed
  header, returned count, and CSV rows.
- Focused checks passed: backend export suite 10 tests; frontend routing and
  export suites 23 tests. Final root `npm run check` PASS with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-hosted-routing-review`.
  Result: `.cache/checks/check-zhvWk3/result.json`; all nine stages passed.
- Hosted browser, PostgreSQL, and live-provider acceptance remain unrun by this
  follow-up. Next action remains deploying both corrected services and completing
  the authorized hosted acceptance above.
