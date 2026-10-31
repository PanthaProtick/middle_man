# Pathao catalogue synchronization

Approved scope: [ADR-0008](adr/0008-persisted-buyer-pathao-location-catalog.md).

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

Connecting or replacing a merchant starts an initial refresh after the settings
response. The worker recovers if that best-effort background task is interrupted.
Seller settings expose catalogue timestamps, refresh failures, manual refresh, and
status reload. A manual refresh can start at most once per minute per shop and
environment; scheduled failure retries wait at least one hour. Default pickup or
service changes retain catalogue authority; replacing credentials does not.

The refresh owns its database session. A short shop-row lock claims a unique
30-minute lease; no database lock or transaction spans provider I/O. At most two
crawls run per worker process, with a 29-minute deadline including semaphore wait.
Each crawl validates complete city/zone/area responses, duplicate IDs, coverage
types, globally unique zone parents, at most 20,000 lists and 200,000 choices.
Existing provider response-size and per-request transport timeouts remain in use.
Provider credentials and tokens are never written into catalogue rows or error
messages. The existing transport issues a short-lived token for each list request;
tokens are not persisted. No automatic retry loop calls Pathao within a crawl.

Publication atomically inserts the complete hierarchy and retires the previous
catalogue, only if the lease and merchant generation remain current. Incomplete,
malformed, failed, timed-out or obsolete work cannot replace usable data. Expired
retired catalogues are removed during successful publication; expiry checks deny
their use even if a later cleanup has not run. Old connection rows are retained as
settings history and cannot authorize current buyer choices.

## Buyer and seller boundaries

Buyer browsing and submission read only saved catalogue lists. Lists are stored
separately so a single city/zone request does not deserialize the whole national
hierarchy. Buyer links still enforce permission, expiry, revocation, retention and
unsubmitted-order checks. Responses remain private and non-cacheable over HTTP.

The buyer's first catalogue read returns an opaque `catalog_version`. Subsequent
child reads and submission use that version. Replaced versions remain valid for
48 hours after replacement; this never extends the order's own 48-hour buyer-link
lifetime. A disconnected/replaced merchant invalidates old versions immediately.
An expired version returns 422 `PATHAO_CATALOG_EXPIRED` with a city field error.
The buyer can explicitly retry lookup to load the current version while keeping
other form details. Old client payloads without a version use the active catalogue.

No initial catalogue means written-address/payment fallback, with seller resolution
required before booking. Failed refreshes retain the last successful catalogue
without an age cutoff for buyer browsing. Seller courier review bypasses the
short-lived live catalogue cache to obtain current provider membership and coverage;
provider failure or unsupported destinations prevent booking approval. Existing
submission/replay, revision, approval and ambiguous-booking safeguards still apply.

## Acceptance evidence

Unit and disposable PostgreSQL tests exercise persistence, replacement, expiry,
merchant scope, failed refreshes and leases. Pending-request frontend tests exercise
interactive parents and ignored late responses. These do not establish live Pathao
coverage, physical-device behavior or hosted schedule execution. Those remain
separate deployment/browser/provider acceptance gates.
