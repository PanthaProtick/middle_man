# Pathao catalogue synchronization (retired)

Historical scope: [ADR-0008](adr/0008-persisted-buyer-pathao-location-catalog.md),
superseded for buyer choices by
[ADR-0009](adr/0009-on-demand-buyer-pathao-locations.md).

Full catalogue synchronization and its crawler have been retired. Buyer browsing and
submission load provider lists on demand without waiting for or depending on full
hierarchy snapshots.

## Decommissioning and worker retirement

1. **Do not install the crawler in new deployments.** New deployments do not require
   any background catalogue crawler or cron schedule.
2. **Decommission hosted schedules.** Existing deployments with an hourly cron or
   job runner executing `npm run refresh:locations` or `python -m app.services.pathao_snapshot_sync`
   should have those scheduled tasks removed by an operator. The CLI entry points
   have been retained as safe no-ops that log retirement notices without making provider
   requests or database modifications. Hosted schedule inspection and removal remain
   **unrun**; no specific hosted schedule has been confirmed. Local retirement does
   not establish that a hosted scheduler was changed.
3. **Retired manual endpoints.** `POST /api/seller/courier/pathao/{env}/catalog/refresh`
   and `GET /api/seller/courier/pathao/{env}/catalog` have been removed and return 404.
4. **Seller UI simplified.** Seller settings no longer display catalogue age, sync
   progress, or refresh buttons. Account connection, environment toggle, pickup store
   selection, and disconnection remain fully supported.

## Schema and historical retention

Migration `0028_pathao_catalog_snapshots.sql` and the associated tables
(`pathao_catalog_snapshots`, `pathao_catalog_lists`, `pathao_catalog_sync`) remain
part of the schema:

- Historical submission records and past order references remain intact without
  destructive migrations or data deletion.
- Application readiness checks and database models continue to recognize the tables
  safely.
- Disconnecting a courier account appends a disabled revision, revoking courier
  booking authority without deleting history.

## Buyer on-demand architecture

- Buyer location queries fetch cities, zones, and areas on demand through
  `/api/public/orders/{portal_token}/pathao-locations`.
- List responses are cached process-locally for 5 minutes. Tokens are reused for
  90% of the provider's `expires_in` lifetime. Requests use single-flight in-flight
  deduplication and bounded rate-limit cooldowns.
- Legacy `catalog_version` request payloads are accepted and ignored.
- Courier review checks fresh provider coverage before booking approval.

## Acceptance evidence

Unit tests and optional PostgreSQL integration scenarios cover:

- Complete absence of crawler network traffic when connecting, reconnecting, or
  invoking sync entry points.
- 404 responses for retired catalogue endpoints.
- Full retention of seller account settings, pickup choices, and disconnection controls.
- Retention and readability of historical snapshot tables in PostgreSQL.

Local verification on 2026-10-31 passed focused backend and frontend tests and the
root check. PostgreSQL integration scenarios were skipped; browser, live-provider
and hosted-scheduling checks remain unrun. See the
[ticket verification record](../.scratch/pathao-on-demand-locations/issues/03-retire-full-catalogue-synchronization.md#verification-record)
for commands, results and limitations.
