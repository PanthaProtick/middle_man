-- ADR-0005: payment screenshots and their AI extraction are retired.
-- Stop old application writers and erase private files before applying this migration.
-- Keep order, receipt, SMS, address and allocation data intact.
DELETE FROM idempotency_records WHERE operation = 'buyer_evidence_upload';
DROP TABLE IF EXISTS payment_extractions;
DROP TABLE IF EXISTS order_evidence;
ALTER TABLE buyer_revisions DROP COLUMN IF EXISTS payment_evidence_id;
