-- Keep historical migrations intact; reject duplicate revision history rather than discarding it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_order_revision ON buyer_revisions(order_id, revision_number);
ALTER TABLE buyer_revisions ALTER COLUMN payment_amount_minor TYPE BIGINT;
ALTER TABLE orders ALTER COLUMN total_minor TYPE BIGINT;
ALTER TABLE orders ALTER COLUMN required_advance_minor TYPE BIGINT;
