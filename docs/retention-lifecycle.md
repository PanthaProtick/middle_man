# Raw Evidence Retention and Deletion Lifecycle

This document records the retention, storage deletion, and external lifecycle policy for raw evidence in Phase 1 (Ticket 18, AC02, AC17, AC39, AC40, AC42, AC43, AC48).

## Retention Boundaries

1. **Raw Evidence (30 Days)**
   - **Raw SMS Bodies**: Incoming SMS message text (`sms_evidence.raw_text`).
   - **Raw AI Prompts / Responses**: Gemini raw request text and raw model output in `address_extractions` (`raw_request`, `raw_response`).
   - **Retention Deadline**: Exactly 30 days from original collection instant (`delete_after = collected_at + 30 days`).
   - **Immutability of Deadlines**: Reprocessing, re-imports, order edits, and customer support actions never extend or reset the original 30-day deletion deadline.

2. **Structured Dependencies and Replay Protection**
   - Deletion removes raw originals only.
   - Structured order states, approved allocations, COD balances, buyer revision summaries, and deduplication markers remain unchanged.
   - When raw SMS is purged (`raw_text = NULL`), the row and its cryptographic digest (`text_digest` with unique constraint `(shop_id, text_digest)`) remain permanently as a tombstone. Re-importing identical SMS text prevents duplicate funds or double allocation (AC17).
   - In accordance with ADR 0001, confirmation represents seller acceptance, not independent payment network truth.

## Storage and Storage Outage Safety

- Raw evidence cleanup clears the retained raw columns only after the transaction can
  commit; structured records and replay markers remain intact.
- If a database outage occurs during cleanup, the transaction fails safely for that
  item: rows are **never** reported deleted before the write is confirmed.
  - The item remains pending cleanup and is reported as overdue/failed in seller retention status.
  - Subsequent cleanup runs safely retry deletion. Complete deletion is acknowledged only after the commit succeeds.
- Completed-order structured retention removes eligible personal records while
  preserving tombstones and minimal payment markers described in the contract annex.

## Local Invocations

1. **Local CLI Runner (Operator / Maintenance)**:
   - Invocation: `python -m app.services.raw_evidence_cli [--shop-id <id>] [--as-of <iso-timestamp>] [--allow-standby]`
   - Scans and deletes raw evidence exceeding 30 days from original collection.
   - Emits structured JSON summary and returns exit code 0 (`clean`) or 1 (`partial_failure`/`failed`).
   - Uses durable database session when configured. Fails closed with `status="failed"` if the database is unconfigured unless `--allow-standby` is explicitly passed.

2. **Seller API Endpoint**:
   - Invocation: `POST /api/seller/retention/cleanup` (authenticated seller).
   - Scans and safely purges due raw evidence for the authenticated seller's shop.

3. **Seller Workspace Panel**:
   - Triggerable via the "Run Evidence Cleanup" button in `EvidenceRetentionPanel.tsx`.


## External Systems & Launch Gates

Local unit tests and PostgreSQL integration run offline using isolated adapters and mock stores. The following external systems cannot have their purge verified by application unlinks alone and remain mandatory **launch gates** before live data pilot operations:

1. **Storage Bucket Versioning & Soft Deletes**
   - In cloud object stores (e.g. AWS S3, Google Cloud Storage), bucket-level object versioning or soft-delete lifecycle rules retain deleted object versions as "delete markers".
   - *Launch Gate*: Before live deployment, object bucket lifecycle rules must be explicitly configured to permanently expire noncurrent versions within the 30-day retention window.

2. **Database Backup & WAL Retention**
   - Point-in-time recovery (PITR) backups and write-ahead logs (WAL) retain historical database states containing raw SMS text and extraction responses prior to deletion.
   - *Launch Gate*: Database backup retention schedules must be documented with explicit backup expiration windows. Application deletion cannot claim immediate physical purge from historical backup archives.

3. **External Provider Logging (Google Gemini)**
   - Gemini API calls transmit buyer address text. Screenshot extraction was retired by ADR-0005.
   - *Launch Gate*: Enterprise API data governance terms must be bound to ensure model provider requests are subject to zero-data-retention or matching retention lifecycles, and that prompt caching or abuse monitoring logs align with privacy policy commitments.
