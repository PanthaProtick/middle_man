-- ADR-0007: address AI extraction is retired. Historical raw requests, provider
-- responses, generated suggestions and extraction replay results are erased.
-- Buyer-confirmed addresses, revisions, payments and allocations are untouched.
-- Stop old application processes before applying this migration.
DELETE FROM idempotency_records WHERE operation = 'address_extraction';
DROP TABLE IF EXISTS address_extractions;
UPDATE idempotency_records
SET response_json = (response_json::jsonb - 'ai_assistance_available')::text
WHERE response_json LIKE '%"ai_assistance_available"%'
  AND response_json::jsonb ? 'ai_assistance_available';
