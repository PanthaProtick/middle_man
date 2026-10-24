-- Order tombstones retain lifecycle and lookup only; first completion never changes.
ALTER TABLE orders ADD COLUMN retained_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN retention_attempted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN retention_error VARCHAR(64);
ALTER TABLE received_transactions ADD COLUMN retained_at TIMESTAMPTZ;
CREATE INDEX ix_orders_retention ON orders (shop_id, completed_at) WHERE retained_at IS NULL;
CREATE TABLE payment_marker_keys (
    shop_id VARCHAR(36) PRIMARY KEY REFERENCES shops(id),
    fingerprint VARCHAR(64) NOT NULL
);
