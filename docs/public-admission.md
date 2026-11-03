# Deployment-wide public admission

## Control and scope

Durable runtimes (production, self-test and real courier booking), and Vercel
preview/production runtimes, reserve a PostgreSQL quota slot before reading the
body, resolving a buyer token or invoking a route. Every request reaching the
admission middleware under `/api/public/orders` consumes the same budget,
including invalid tokens and methods. CORS preflight responses handled by the
outer CORS middleware do not reach domain routes or consume slots.

Migration `0029_public_admission.sql` creates a singleton row. An atomic
`INSERT ... ON CONFLICT DO UPDATE ... WHERE` reserves at most the configured
number of slots per database-clock window. The transaction commits before route
execution. Every process and replacement using the same database/schema shares
this row; no client-controlled key or IP header selects a separate quota.
The table stores no tokens, addresses, IPs or buyer data and remains one row.
No periodic cleanup is needed. Do not delete/reset it on worker startup.

This uses ordinary PostgreSQL, not a Vercel Firewall paid-plan feature or a new
service. PostgreSQL documents atomic upsert under concurrency in its
[INSERT reference](https://www.postgresql.org/docs/18/sql-insert.html).
Neon supports PostgreSQL connections and pooling on all plans, including Free;
see its [pooling support note](https://neon.com/blog/postgres-support-case-recap)
and [plan inventory](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md).
That establishes feature availability, not production capacity or availability.
Owner plan/region/connection-budget acceptance remains ticket 09.

## Configuration and failure behavior

- Set identical `PUBLIC_REQUESTS_PER_WINDOW` (default 600) and
  `PUBLIC_REQUEST_WINDOW_SECONDS` (default 60) across all concurrent deployments.
  Keep `PUBLIC_REQUEST_MAX_BYTES` (default 65536) consistent too.
- Apply migrations with the established migration procedure before deployment.
  Runtime credentials need SELECT, INSERT and UPDATE on `public_admission`.
  Readiness checks include its table, columns and migration ledger.
- Production workers must target the same writable primary database/schema.
  Independent databases create independent budgets. Preview must use its isolated
  database and never production credentials. Old and new deployments sharing a
  database intentionally share the budget; changing settings during a rolling
  deployment requires draining old workers first.
- Exhaustion returns `429 PUBLIC_RATE_LIMITED`, private/no-store headers and
  `Retry-After` equal to the full configured window (a conservative delay).
  Expiration and reset use database time; application clock drift cannot reset it.
- Missing storage/table, database errors or a three-second reservation timeout
  return `503 PUBLIC_ADMISSION_UNAVAILABLE` and `Retry-After: 5`. There is no
  process-local fallback. An ambiguous commit may waste a slot; the route never
  runs unless admission confirms success. Cancellation propagates and the session
  context releases its resources. Driver diagnostics never enter buyer responses.
- Offline non-Vercel development keeps the existing per-worker best-effort quota
  without requiring PostgreSQL. It does not establish shared enforcement.

Admitted bodies still have declared and actual-byte limits and return
`413 PUBLIC_BODY_TOO_LARGE`. Quota slots count attempts, including oversized bodies
and failed domain operations. Rejection grants no authority and confirms no write.
Keep buyer input and the original idempotency key when recovering a prior attempt.

## Operational limits

This is a fixed-window aggregate budget, not per-buyer fairness: one caller can
exhaust it, and bursts around a boundary can consume two windows' allowances in a
short interval. Each attempted request incurs a database operation; rejected
traffic still contends on the singleton row. Budget connection pools, database
compute and Vercel concurrency together. Sleep/cold-start or pool saturation can
produce fail-closed 503s. Use ingress/transport controls for volumetric attacks,
connection counts, slow clients and buffering before Python; this application
control does not protect those resources. No hosted DDoS capability is claimed.

Pathao on-demand caches, token reuse, cooldowns and coalescing remain process-local
optimizations; they do not coordinate a provider-wide quota. Admission reduces
public route traffic but does not bound seller/provider traffic or prove provider
capacity. See [cross-instance ownership](cross-instance-durability.md).

## Reproducible verification and deployment acceptance

Use disposable loopback PostgreSQL only. Set `BUYER_TEST_POSTGRES_URL` to that
server's administrative database, then run:

```powershell
npm run test:backend -- tests/test_shared_admission_postgres.py tests/test_public_admission.py
```

Tests create/drop isolated databases, apply migrations, launch independent HTTP
workers, race 12 requests for three slots, replace workers, expire the database
window, remove the control table and hold a row lock through the timeout. Existing
ASGI tests cover missing/false Content-Length, bounded streams and exact limits.
They exercise real PostgreSQL locally; they do not establish hosted enforcement.

For ticket 09, on an isolated hosted acceptance database with synthetic orders:

1. Apply migrations; verify startup readiness and consistent settings/database
   identity across all active instances without logging connection secrets.
2. Select a small quota and send concurrent valid-link requests to at least two
   independently identified instances within one window. Record request counts,
   response codes, retry/private headers and instance evidence, never raw links.
   Assert total accepted requests never exceeds the quota. Restart/replace an
   instance and prove it cannot acquire another allowance before expiration.
3. Verify invalid tokens and changed forwarding headers cannot bypass exhaustion;
   health and seller routes retain their existing contracts. After expiration,
   verify admission resumes and oversized bodies still receive 413 when admitted.
4. In that isolated environment only, deny control-table permission or disrupt
   database connectivity. Confirm 503 with actionable retry guidance, no buyer
   mutation and no diagnostic leakage; restore access and verify recovery.
5. Exercise Neon TLS/pooler, cold starts, freeze/thaw and concurrency within the
   selected plan's budgets. Record deployment IDs, configuration fingerprints,
   timing and results in ticket 09. Keep public launch blocked on failed checks.

Actual deployed enforcement remains **pending ticket 09**. No hosted test,
account configuration, browser acceptance or live provider call occurred here.
