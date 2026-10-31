# Pathao catalogue synchronization

Historical scope: [ADR-0008](adr/0008-persisted-buyer-pathao-location-catalog.md),
superseded for buyer choices by
[ADR-0009](adr/0009-on-demand-buyer-pathao-locations.md). Buyer browsing and
submission now load provider lists on demand; this retained snapshot workflow no
longer gates those choices. Connecting a merchant no longer starts a crawl, and
manual refresh/status surfaces remain only until the separate retirement work
removes them.

Apply migration `0028_pathao_catalog_snapshots.sql` before deploying this version.
Application readiness requires the three new catalogue tables. This migration also
adds the connection's `enabled` flag; a disconnection appends a disabled revision,
revoking old catalogue and reviewed-booking authority without deleting history.

## Worker and deployment

Run `npm run refresh:locations` from the repository root in the application's
configured database/credential environment. It performs one sweep of merchant and
environment pairs, refreshing complete catalogues older than one day and retrying
failed or abandoned refreshes. Schedule this command **hourly** in the deployment's
job runner. An hourly sweep provides daily refreshes and bounded failure recovery;
the application does not install or claim a hosted schedule itself.

Connecting or replacing a merchant does not start a refresh. Buyer requests do not
wait for or require this catalogue. Seller settings expose catalogue timestamps,
refresh failures, manual refresh, and status reload for the retained workflow. A
manual refresh can start at most once per minute per shop and environment; scheduled
failure retries wait at least one hour. Default pickup or service changes retain
catalogue authority; replacing credentials does not.

The refresh owns its database session. A short shop-row lock claims a unique
30-minute lease; no database lock or transaction spans provider I/O. At most two
crawls run per worker process, with a 29-minute deadline including semaphore wait.
Each crawl validates complete city/zone/area responses, duplicate IDs, coverage
types, globally unique zone parents, at most 20,000 lists and 200,000 choices.
Existing provider response-size and per-request transport timeouts remain in use.
Provider credentials and tokens are never written into catalogue rows or error
messages. A crawl reuses one valid token through the shared location transport;
tokens are not persisted. No automatic retry loop calls Pathao within a crawl.

Publication atomically inserts the complete hierarchy and retires the previous
catalogue, only if the lease and merchant generation remain current. Incomplete,
malformed, failed, timed-out or obsolete work cannot replace usable data. Expired
retired catalogues are removed during successful publication; expiry checks deny
their use even if a later cleanup has not run. Old connection rows are retained as
settings history and cannot authorize current buyer choices.

## Buyer and seller boundaries

Buyer browsing and submission load the requested city, zone or area on demand and do
not read saved snapshot lists. Only the selected branch and the parent membership
lists needed to validate it are requested. Buyer links still enforce permission,
expiry, revocation, retention and unsubmitted-order checks before cache hits or
provider work. Responses remain private and non-cacheable over HTTP.

Valid tokens are reused until shortly before expiry. Lists are cached for five
minutes and keyed by shop, environment, connection revision, hierarchy level and
parent. Identical in-process requests share provider work, and auth/location rate
limits set bounded cooldowns using valid `Retry-After` guidance or exponential
backoff. This coordination is process-local, not deployment-wide. A still-valid
cached list may serve a request during a provider problem; expired entries do not
acquire an indefinite stale lifetime. Provider failures are not cached as successful
empty lists. Legacy `catalog_version` payloads are accepted and ignored.

Provider unavailability means written-address/payment fallback, with seller
resolution required before booking. Seller courier review bypasses buyer caches to
obtain current provider membership and coverage; provider failure or unsupported
destinations prevent booking approval. Existing submission/replay, revision,
approval and ambiguous-booking safeguards still apply.

## Acceptance evidence

Unit and disposable PostgreSQL tests exercise retained snapshot persistence,
replacement, expiry, merchant scope, failed refreshes and leases. Controlled
provider-transport tests exercise on-demand token/list reuse, concurrent requests,
rate-limit cooldowns, failures, cancellation cleanup and recovery. Rendered
frontend tests exercise interactive parents, ignored late responses, retained
details and retry after unavailability. These do not establish live Pathao
coverage, physical-device behavior or hosted schedule execution. Those remain
separate deployment/browser/provider acceptance gates.
