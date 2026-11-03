# 07: Deployment-wide public admission protection

**What to build:** Public requests face a documented, verifiable deployment-wide admission control with bounded bodies and actionable rejection behavior across backend instances.

**Blocked by:** 05: Vercel deployment and isolated preview routing.

**Status:** resolved

- [x] Select a verified platform control or shared limiter and record its scope, supported plan, configuration, failure behavior, and operational constraints before public launch.
- [x] Demonstrate that aggregate requests across instances cannot bypass the intended deployment-wide limit; a per-worker quota alone does not satisfy acceptance.
- [x] Preserve existing body limits and buyer-link authority; rejected or failed requests return actionable errors without simulated success or leaking sensitive data.
- [x] Keep provider cooldown/coalescing limits distinct from public admission protection and document their cross-instance limitations.
- [x] Add meaningful tests or reproducible control verification for accepted requests, rejected requests, cross-instance enforcement, and relevant control failures. Offline development remains possible.
- [x] Provide deployment and operator verification instructions; record actual deployed enforcement as pending until ticket 09 if no hosted verification occurred.
- [x] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact.

## Implementation evidence (2026-11-04)

- Base: `42c47d49fc55a942bf8d7b4f0b00cbf78e9bd8c4`; current branch retained.
- User approved ASGI request and shared-control adapter seams for TDD.
- Added PostgreSQL singleton admission with atomic conditional upsert and database
  time, committed before public route execution. Durable/Vercel runtimes fail
  closed; offline non-Vercel development retains the local limiter. Existing body
  bounds, link gates and domain contracts remain in force.
- Added migration 0029, readiness inventory, environment examples, control scope,
  plan/permission constraints, operational costs and verification instructions in
  `docs/public-admission.md`. Provider-local coordination remains distinct.
- Initial missing-storage regression: 1 failed / 7 passed before implementation;
  then 8 passed. `npm run typecheck`: passed both applications.
- Independent real HTTP workers against disposable PostgreSQL: concurrent aggregate
  budget, worker replacement, window recovery, missing table, lock timeout,
  oversized body and invalid-link checks. Final focused command:
  `npm run test:backend -- tests/test_shared_admission_postgres.py tests/test_migrations.py tests/test_migrations_postgres.py tests/test_public_admission.py`
  passed 29 tests with `BUYER_TEST_POSTGRES_URL` pointing at loopback PostgreSQL.
  Adjacent buyer-boundary/policy/production-link tests passed 22 tests.
- Environment recovery: `pg_ctl` could not create a Windows restricted token;
  direct hidden PostgreSQL launch succeeded. Default pytest temp access failed;
  subsequent runs used repository-local `.cache/` base temp directories.
- Hosted enforcement, Neon TLS/pooler, platform concurrency and browser/live-provider
  acceptance remain pending ticket 09. No remote deployment or account changes.
- Independent Standards/Spec review identified one stale contract paragraph about
  independent worker quotas; corrected it to offline-only. No other findings.
- First root gate: FAIL, `.cache/checks/check-UV0JyB/result.json`; backend 955
  passed / 1 failed because a third migration-inventory test expected 28 files.
  Updated count and ordered prefix range for migration 0029; focused
  `npm run test:backend -- tests/test_durable_postgres.py`: 4 passed. Remaining
  frontend/build/smoke stages were not run after that backend failure.
- Final root `npm run check`: PASS, `.cache/checks/check-df66OI/result.json`; all nine stages passed. PostgreSQL enabled: backend 956 passed, zero skipped; frontend 687 passed in 126 files; build and HTTP smoke passed. Local implementation complete; hosted acceptance remains ticket 09.
