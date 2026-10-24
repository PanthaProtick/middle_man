# Raw Evidence Retention and Deletion Lifecycle

This document records the retention, storage deletion, and external lifecycle policy for raw evidence in Phase 1 (Ticket 18, AC02, AC17, AC39, AC40, AC42, AC43, AC48).

## Retention Boundaries

1. **Raw Payment Evidence (30 Days)**
   - **Screenshots / Images**: Uploaded buyer payment screenshots (`order_evidence` table) and associated storage files.
   - **Raw SMS Bodies**: Incoming SMS message text (`sms_evidence.raw_text`).
   - **Raw AI Prompts / Responses**: Gemini raw request text and raw model output in `address_extractions` (`raw_request`, `raw_response`) and `payment_extractions` (`raw_response`).
   - **Retention Deadline**: Exactly 30 days from original collection instant (`delete_after = collected_at + 30 days`).
   - **Immutability of Deadlines**: Reprocessing, re-imports, order edits, and customer support actions never extend or reset the original 30-day deletion deadline.

2. **Structured Dependencies and Replay Protection**
   - Deletion removes raw originals only.
   - Structured order states, approved allocations, COD balances, buyer revision summaries, and deduplication markers remain unchanged.
   - When raw SMS is purged (`raw_text = NULL`), the row and its cryptographic digest (`text_digest` with unique constraint `(shop_id, text_digest)`) remain permanently as a tombstone. Re-importing identical SMS text prevents duplicate funds or double allocation (AC17).
   - In accordance with ADR 0001, confirmation represents seller acceptance, not independent payment network truth.

## Storage and Storage Outage Safety

- When raw images reach their deadline, cleanup invokes `delete_evidence_file(storage_key)`.
- If an outage occurs during deletion (e.g. storage service 5xx or filesystem IO failure), the transaction fails safely for that item:
  - Database records are **never** marked deleted before the underlying storage copy is confirmed removed.
  - The item remains pending cleanup and is reported as overdue/failed in seller retention status.
  - Subsequent cleanup runs safely retry deletion. Complete deletion is acknowledged only after file removal succeeds.

## External Systems & Launch Gates

Local unit tests and PostgreSQL integration run offline using isolated adapters and mock stores. The following external systems cannot have their purge verified by application unlinks alone and remain mandatory **launch gates** before live data pilot operations:

1. **Storage Bucket Versioning & Soft Deletes**
   - In cloud object stores (e.g. AWS S3, Google Cloud Storage), bucket-level object versioning or soft-delete lifecycle rules retain deleted object versions as "delete markers".
   - *Launch Gate*: Before live deployment, object bucket lifecycle rules must be explicitly configured to permanently expire noncurrent versions within the 30-day retention window.

2. **Database Backup & WAL Retention**
   - Point-in-time recovery (PITR) backups and write-ahead logs (WAL) retain historical database states containing raw SMS text and extraction responses prior to deletion.
   - *Launch Gate*: Database backup retention schedules must be documented with explicit backup expiration windows. Application deletion cannot claim immediate physical purge from historical backup archives.

3. **External Provider Logging (Google Gemini)**
   - Gemini API calls transmit buyer address text and screenshot image tokens.
   - *Launch Gate*: Enterprise API data governance terms must be bound to ensure model provider requests are subject to zero-data-retention or matching retention lifecycles, and that prompt caching or abuse monitoring logs align with privacy policy commitments.
