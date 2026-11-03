# Cross-instance durability and runtime ownership

Ticket 06 covers durable seller/buyer workflows. Hosted Vercel acceptance remains
ticket 09; public admission coordination belongs to ticket 07.

## Correctness state

| State | Authority and replacement behavior |
| --- | --- |
| Shops, accounts, orders, buyer revisions and saved links | PostgreSQL; encrypted link recovery requires the original stable `ORDER_LINK_ENCRYPTION_KEY`. |
| Mutation receipts and submission recovery | PostgreSQL idempotency records committed with domain writes; shop/order row locks serialize competing writes. Durable submission keys retain the `durable.` epoch across processes. |
| Received transactions, observations, allocations and consumed payment identities | PostgreSQL, including marker-key bindings; retain the original independent `PAYMENT_MARKER_SECRET` (or configured legacy identity secret). Receipt allocation and used-marker constraints remain authoritative. |
| Courier connections, drafts, attempts and reconciliation receipts | PostgreSQL; provider outcomes remain explicit, including unknown outcomes. Local coordination cannot establish booking success. |
| Standby dictionaries, local mutation locks and random standby storage epoch | Offline demo only; durable mode rejects absent storage rather than falling back. Demo state does not survive replacement. |
| Clerk verification keys | Process-local cache of verification material; missing entries require verification/key fetch, never a grant of authority. Provider/key outages can reject requests. |
| Pathao on-demand location lists, access tokens, locks and cooldowns | Process-local optimizations; credential revision keys and database rechecks preserve seller connection/link authority. Missing entries can cause extra provider calls or unavailable suggestions. Written-address fallback and seller resolution remain required. |
| Retained Pathao snapshot jobs and publication | In durable mode, PostgreSQL `CatalogSyncTable` leases/cooldown metadata and shop locks coordinate refresh claims and atomic publication. `_jobs` is only the standby alternative; these jobs are separate from on-demand lookup coordination. |
| Public admission counter | PostgreSQL singleton quota for durable/Vercel runtimes; offline development remains process-local. See [admission control](public-admission.md) for scope, fail-closed behavior and pending hosted verification. |
| Template items and diagnostics | Process-local, outside durable seller workflows. |

Stable secrets must match across every concurrent/replacement instance and remain
independent across production and preview resources. Rotating a key without a
compatible migration can prevent recovery; do not generate keys per startup.
Read [production secret requirements](production-secrets.md).

## Database engine and request sessions

`core/database.py` owns one async engine and session factory per imported runtime.
Each dependency invocation owns one session; sessions are never shared between
requests or concurrent tasks. Context exit closes the session and releases its
transaction even on cancellation. Database failures return an explicit failure;
clients recover using the original mutation key instead of assuming no commit.

The application lifespan now disposes its engine in `finally`, including failed
startup or interrupted lifespan exit. Abrupt process death cannot run shutdown
hooks; PostgreSQL rolls back open transactions when its connections disappear.
Already committed work remains durable. Disposal permits later engine reuse.

Retain SQLAlchemy's bounded async pool with pre-ping. Each warm process has its own
pool; total connections scale with worker/instance count, not one shared pool.
The current default permits five pooled connections plus ten overflow connections
per process. Size platform concurrency and database limits together. Existing
pooler-host handling disables driver statement caches/preparation as configured
in `database_engine.py`; hostname detection does not prove pooler compatibility.
No evidence here justifies switching all requests to unpooled connections.

Local tests use Windows, Python 3.12, Uvicorn, SQLAlchemy and asyncpg against
PostgreSQL 18.4. Hosted Vercel Linux, its event-loop reuse, freeze/thaw behavior,
Neon TLS/pooler operation, actual concurrency and connection budgets remain unrun.
Validate those in ticket 09 before claiming deployed runtime acceptance.

## Provider coordination limits

Pathao list/token request coalescing and cooldown timers coordinate only one
process. Two instances can independently issue requests or observe a 429; one
instance's cooldown does not suppress the other's requests. Replacement discards
cooldowns and cached tokens. These mechanisms do not enforce provider-wide quotas
or guarantee deployment-wide token reuse. Cross-instance rate pressure requires
provider-aware shared coordination or ingress controls if operational evidence
warrants it; do not describe local locks as distributed protection.

## Reproducing local evidence

Set `BUYER_TEST_POSTGRES_URL` to a **disposable loopback PostgreSQL** administrative
target. The instance fixture creates randomly named databases, initializes each
through the canonical migration runner, and drops only those owned databases.
The role needs create/drop database and backend-termination permission.

Run root `npm run test:backend -- tests/test_cross_instance_postgres.py` and
`npm run test:backend -- tests/test_instance_lifecycle_postgres.py`.
Tests without the variable skip explicitly. Logs are under pytest's temporary
directory; use a workspace-local `--basetemp` when Windows system temp is blocked.

The HTTP harness starts independent server processes with independent imports,
engines, pools, event loops and memory stores. It uses the real application
lifespan and durable self-test settings, stable synthetic keys, and an explicit
synthetic seller identity override. It tests storage, not hosted Clerk auth.
Both original processes terminate before replacement reads/retries. Database loss
disables new connections and terminates worker connections, then restores access.
Lifecycle tests separately verify connection release and cancellation rollback.
