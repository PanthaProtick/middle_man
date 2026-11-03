# 08: Authenticated scheduled retention

**What to build:** The operator can schedule authenticated, retry-safe retention maintenance with visible failures and a documented recovery procedure while preserving the existing deletion policy.

**Blocked by:** 01: Repeatable clean-database initialization; 05: Vercel deployment and isolated preview routing.

**Status:** needs-info (implemented; disposable PostgreSQL acceptance target required)

- [x] Provide a scheduling-compatible authenticated invocation of existing retention operations; reject missing or invalid scheduler authorization without granting seller impersonation.
- [x] Preserve existing lifecycle rules, cutoff boundaries, shop scope, and payment-protection retention requirements; leave unrelated and ineligible records intact.
- [x] Repeated or overlapping execution is safe, and partial failures remain observable and retryable without falsely reporting complete cleanup.
- [ ] Tests cover authorization, repeat execution, overlap where applicable, cutoff boundaries, failure reporting, and preservation of ineligible records. Use PostgreSQL for durable behavior evidence.
- [x] Document scheduling cadence, platform/plan constraints, environment-scoped secrets, failure visibility, missed-run recovery, and safe operator retry.
- [x] Do not revive retired screenshot storage or location catalogue crawling; verify deployed scheduling separately in ticket 09.
- [x] Run focused checks and final root `npm run check`; record exact results, the fresh result artifact, and any unrun PostgreSQL gates.

## Implementation evidence (2026-11-04)

- Base: `9aa7663b18e369bfce58f27f54cc81c02c786bac`; current branch `main` retained.
- User approved HTTP scheduler and PostgreSQL retention-service test seams.
- Added `GET /api/maintenance/retention`, dedicated constant-time scheduler bearer
  authorization, typed aggregate success/error contracts, and no-store responses.
  Empty secret or absent durable database fails closed; no seller identity is granted.
- Configured backend-only daily Vercel cron at 00:00 UTC. Production and preview
  templates contain empty, environment-scoped scheduler credentials.
- Orchestrator discovers durable shops and runs existing raw/structured policies
  with independent per-shop phase sessions. Failures return 503 and safe aggregate
  logs; later phases/shops continue, and committed work survives retry. Existing
  structured shop locks remain; raw SMS selection now locks eligible rows.
- Policy rules and cutoff calculations are unchanged. No screenshot storage or
  catalogue crawling was introduced. Operations/recovery: `docs/scheduled-retention.md`;
  linked lifecycle, contract, and deployment docs were updated.
- New files: `backend/app/{api,models,services}/scheduled_retention.py`,
  `backend/tests/test_scheduled_retention.py`, and
  `backend/tests/test_scheduled_retention_postgres.py`. Other changes: config/main,
  raw cleanup row locking, test credential isolation, Vercel config/templates,
  deployment tooling tests, and the documents above.

## Verification and review

- Authorization red: 4 expected missing-route failures / 1 existing seller-denial
  pass after introducing the settings field. HTTP green: 5 passed, repeated after
  the response-contract review fix.
- Focused HTTP/PostgreSQL/raw cleanup/structured run: 6 passed, 9 skipped.
  Focused HTTP/PostgreSQL/raw status run: 7 passed, 2 skipped.
- `npm run typecheck`: both applications passed twice. Deployment tooling:
  `node --test scripts/vercel.test.mjs`: 3 passed.
- Initial commit-hook root check passed, artifact
  `.cache/checks/check-fgkXUR/result.json`.
- Final-check attempt `.cache/checks/check-NCzBwF/result.json` failed: 758 backend
  passed, 202 skipped, 3 temp-directory permission errors; later stages unrun.
- Final root `npm run check` with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-retention-final`: PASS.
  Fresh result: `.cache/checks/check-MFrq1V/result.json`. Backend: 761 passed,
  202 skipped. Frontend: 126 files / 687 tests passed. Tooling, conventions,
  backend lint/types, frontend lint/build, and HTTP smoke all passed.
- Independent code review since the base: Standards found one Pydantic HTTP
  response-contract gap, fixed and re-reviewed (0 remaining findings). Spec found
  one outstanding acceptance requirement: PostgreSQL evidence is not available.
- PostgreSQL NOT RUN: `BUYER_TEST_POSTGRES_URL` is unset. Added isolated-schema
  tests cover exact cutoff, two-shop raw work, overlap/repeat, protected payment
  replay, failed raw transaction with successful structured commit, HTTP 503,
  and recovery. Existing PostgreSQL retention tests also skipped. These test
  definitions do not establish durable behavior until executed.
- Hosted scheduler, production secrets, alerts, provider/backup erasure and
  preview/production recovery remain NOT RUN; ticket 09 owns deployed acceptance.

## Next action

Provide a disposable loopback PostgreSQL target via `BUYER_TEST_POSTGRES_URL`;
run the new scheduler PostgreSQL file and existing structured/personal retention
PostgreSQL suites, then repeat the root gate. Keep the PostgreSQL acceptance item
open until real durable evidence is recorded. Configure and verify the hosted
schedule/monitoring separately in ticket 09.
