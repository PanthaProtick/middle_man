# Retention, AI policy, and retired surfaces

## Raw evidence retention and cleanup (Ticket 18)

- Raw SMS bodies expire 30 days from original collection. Reprocessing/reimport
  never restarts deadlines.
- `purge_raw_evidence` sets the raw `raw_text` column to NULL. Structured
  observations, claims, order status, accepted allocation, COD, and used-payment
  markers remain intact.
- `GET /api/seller/retention/status` provides owning-seller visibility into retained vs
  purged counts, overdue items, and failure history without cross-shop or raw content leaks.
- `POST /api/seller/retention/cleanup` runs safe, retryable cleanup for the owning shop.
- CLI local invocation: `python -m app.services.raw_evidence_cli [--shop-id <id>] [--as-of <iso-timestamp>] [--allow-standby]`
  runs repeatable background/operator cleanup with JSON summary and exit code 0 (clean) or 1 (partial_failure/error).
  Without `--allow-standby`, requires an initialized database connection and fails closed rather than claiming clean status.
- Storage outages prevent acknowledgement or marking records deleted until required copies are removed.
- External storage bucket version history, database backup retention lifecycles, and
  third-party AI provider logging terms remain explicit launch gates, not false deletion claims.

## Completed structured record retention (Ticket 19)

- GET `/api/seller/retention/structured` returns typed `checked_at`, `overdue`,
  `failed`, `removed` and `standby`. POST `/api/seller/retention/structured/cleanup`
  retries the owning shop's due records using server time. Neither accepts a shop
  identifier or deletion clock from the caller. The integrated seller panel reloads
  orders and receipts after cleanup. Database outages return unavailable, never a
  successful deletion response. `standby` identifies the explicit offline adapter.
- `purge_completed_orders(db, now, shop_id)` is the maintenance seam: invoke it
  repeatedly from an operator/scheduler with its own database session. Due work is
  discovered from durable completion timestamps; per-order attempts and safe failure
  codes survive restart. A failed order is rolled back independently and retried.
  Hosting/scheduling this maintenance is a deployment gate; no hosted scheduler has
  been installed. Run the raw-evidence worker separately at its 30-day deadline.
- The deletion date is the first completion plus 12 calendar months, clamping leap
  day to February's last day. Cancellation and later corrections preserve the first
  completion. Unopened awaiting-buyer records use their original expiry as completion.
- Remove buyer revisions, matching review reasons,
  order audits, token-open measurements and personal replay-cache results. Shared
  receipt observations/audits remain while any unresolved or not-yet-due order
  needs their historic identities. Standalone unmatched receipts have no new period.
  Raw SMS retains its separate original 30-day deadline.
- Order tombstones preserve shop/ID, token lookup digest, lifecycle, completion and
  replacement links. Remove recoverable portal tokens and commercial snapshot text.
  Owning seller detail/history/summary and buyer reads return 410 `RECORD_UNAVAILABLE`;
  order lists and CSV exports omit tombstones. Historical confirmations do not become
  expired. Replay caches return unavailable rather than replaying personal responses.
- Consumed receipts retain a nonspendable allocation/receipt skeleton to preserve
  relational uniqueness, with readable TrxID/sender, amounts and decision text removed.
  Independent shop/provider keyed identity markers survive. The HMAC uses a dedicated
  `PAYMENT_MARKER_SECRET` independent of authentication credentials; migration 0017 binds
  a per-shop key fingerprint. A changed or missing key blocks receipt ingestion, reconciliation, manual acceptance and
  structured cleanup. Legacy bindings require all existing markers to verify against
  retained identities first. Restore the original key to recover; key rotation requires
  a separately reviewed migration, never silently rebinding after details are removed.
- Account deletion, standalone unmatched structured-receipt retention, storage version
  history, backup purge and provider/log copies remain unsettled launch gates. These
  endpoints and local checks do not establish real-data readiness or deploy anything.

## Self-test AI policy

`SELF_TEST_MODE=true` disables Gemini generation regardless of credentials. Public
demo chat and idea calls remain local in self-test mode, and automated tests never
contact a provider.

Public order responses no longer expose an address-assistance availability signal.
Buyers enter addresses manually; no configuration value or credential restores
address parsing.


## Payment screenshot retirement (ADR-0005)

Payment claims contain manual payment details only. Legacy `evidence_id` fields
are rejected with 422, including seller corrections. Buyer `/evidence` and
`/payment-extraction` and seller `/evidence/{id}` routes no longer exist (404).
Migration 0026 removes screenshot metadata, AI payment extractions, upload replay
records, and revision screenshot references. Stop old application processes and
erase the verified private storage directory before applying it. SMS retention,
payment matching, accepted allocations and courier COD are preserved.

## Address AI retirement (ADR-0007)

Migration `0027_retire_address_ai.sql` drops `address_extractions`, which held raw
address requests, provider responses, generated suggestions and extraction replay
results, and removes the obsolete `ai_assistance_available` key from cached
submission responses. No public route parses addresses. Buyer-confirmed address
revisions, payment claims, receipts, allocations, lifecycle and duplicate-payment
protection survive. Raw-evidence retention and cleanup now cover SMS only.
Provider-held copies and backups remain outside what this migration can prove
deleted.
