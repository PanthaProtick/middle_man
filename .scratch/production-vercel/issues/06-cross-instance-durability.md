# 06: Durable workflows across backend instances

**What to build:** Sellers and buyers can retry and resume work across backend replacement or concurrent instances without losing committed records, duplicating actions, or weakening payment protections.

**Blocked by:** 01: Repeatable clean-database initialization; 03: Production seller sessions and shop isolation; 04: Production buyer-link workflow; 05: Vercel deployment and isolated preview routing.

**Status:** resolved

- [x] Separate application instances sharing PostgreSQL preserve seller orders, payment records, saved buyer links, and permitted buyer submissions across instance replacement.
- [x] Exercise concurrent and retried writes to verify durable idempotency, payment single-use/reuse protection, and existing seller-confirmation boundaries.
- [x] Audit database engine/session ownership against the selected runtime, including repeated requests, connection reuse, concurrency, cancellation, and cleanup. Change pooling or ownership only when evidence requires it.
- [x] Classify process-local state: local caches may remain only where missing or stale entries do not change correctness; shared correctness protections must be durable.
- [x] Document provider cooldown and request-coalescing limitations across instances without claiming deployment-wide coordination.
- [x] Database loss produces explicit failure without false committed success. Stable application secrets preserve link recovery and payment protections across replacement.
- [x] Use real disposable PostgreSQL for multi-instance and concurrency tests, and record the runtime exercised. Keep simulated/local evidence separate from deployed runtime acceptance.
- [x] Run focused checks and final root `npm run check`; record exact results, the fresh result artifact, and any blocked integration evidence.

## Implementation evidence (2026-11-04)

- Base: `c567f46b5f4b254d3eb60246eb6022c61ced94f4`; current branch retained.
- User approved HTTP API across independent processes and database lifecycle seams.
- Tests start real Uvicorn workers with independent imports, engines, event loops,
  pools and memory stores; restart both before recovery. Disposable loopback
  PostgreSQL 18.4 databases use the canonical migration runner and ledger.
- Configured stable synthetic link/marker secrets and synthetic seller identity;
  durable self-test startup is real. Hosted Clerk authentication is not exercised.
- Real PostgreSQL/HTTP checks: concurrent same-key order creation and buyer replay,
  saved-link recovery, payload conflict, forbidden buyer resubmission, competing
  payment claims blocked until seller review, concurrent reviewed receipt allocation,
  replacement replay and reuse rejection. Database connection denial/termination
  returns 503; original-key retry and replay succeed after restored access.
- Lifecycle red: idle connection remained after shutdown (1 failed / 1 passed).
  Added engine disposal in lifespan `finally`; cancellation already cleaned up.
  Lifecycle green with normal/interrupted exit and reuse: 3 passed.
- Independent-process tests: 3 passed. Typechecking passed both applications twice.
- Harness corrections before acceptance: asyncpg application-name URL is unsupported;
  use SQL session setting; explicit loopback TLS disable avoids inherited PGSSLMODE;
  canonical migration runner supplies ledger; review endpoint preserves competing
  claim protection; database connection denial must be administered from another DB.
- No pool policy changes: bounded per-process pool/pre-ping retained. Documented
  ownership, standby stores, Pathao token/list caches and local locks/cooldowns,
  public admission limitation, stable secrets and runtime constraints in
  `docs/cross-instance-durability.md`.
- Runtime: Windows, Python 3.12.13, Uvicorn, SQLAlchemy/asyncpg, PostgreSQL 18.4.
  Vercel Linux/freeze-thaw/event-loop reuse, Neon TLS/pooler, hosted connection
  budgets, real providers, hosted auth/browser and deployment acceptance remain
  unrun; ticket 09 owns deployed acceptance and ticket 07 shared public admission.
- Independent review: Standards identified missing kill/wait fallback and log
  cleanup on worker startup/shutdown failure; fixed. Spec identified inaccurate
  snapshot-job classification; corrected durable lease/publication ownership.
- First root gate with all real PostgreSQL tests enabled: FAIL, 940 passed /
  8 failed, `.cache/checks/check-CS3PxD/result.json`; frontend/build/smoke not run
  after the backend failure. All new durability tests passed.
- Repaired dormant PostgreSQL test drift: locale/monkeypatch forwarding, explicit
  historical snapshot seeding after crawl retirement, selected buyer location for
  connected courier, schema-owner readiness patch, and derived read staging versus
  unchanged mutation receipt. No production behavior or assertion weakening.
  Focused five PostgreSQL files: 32 passed.
- Follow-up independent review: Standards 0 remaining / Spec 0 remaining findings.
- Final root `npm run check`: PASS, all ten stages including conventions; artifact
  `.cache/checks/check-CUOR3Y/result.json`. PostgreSQL enabled: backend 951 passed,
  zero skipped; frontend 687 passed in 126 files; build and HTTP smoke passed.
- Final diff whitespace check fixed one extra blank line at EOF; no behavior changed.
- Completed local ticket scope. Hosted acceptance remains ticket 09; no deployment
  or live provider operation performed. Disposable PostgreSQL server stopped.
