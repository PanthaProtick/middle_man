-- Migration 0025: Durable seller reconciliation of unknown booking outcomes
ALTER TABLE courier_attempts
    ADD COLUMN IF NOT EXISTS resolution_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resolution_action VARCHAR(32),
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS courier_reconciliations (
    id VARCHAR(36) PRIMARY KEY,
    attempt_id VARCHAR(36) NOT NULL REFERENCES courier_attempts(id),
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    actor VARCHAR(255) NOT NULL,
    action VARCHAR(32) NOT NULL,
    resolution_version INTEGER NOT NULL,
    resulting_status VARCHAR(16) NOT NULL,
    environment VARCHAR(16) NOT NULL,
    consignment_id VARCHAR(64),
    merchant_order_id VARCHAR(64),
    evidence JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_courier_reconciliations_attempt_version UNIQUE (attempt_id, resolution_version)
);

CREATE INDEX IF NOT EXISTS ix_courier_reconciliations_shop_id ON courier_reconciliations(shop_id);
CREATE INDEX IF NOT EXISTS ix_courier_reconciliations_order_id ON courier_reconciliations(order_id);
CREATE INDEX IF NOT EXISTS ix_courier_reconciliations_attempt_id ON courier_reconciliations(attempt_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_reconciliations_consignment
    ON courier_reconciliations(consignment_id) WHERE consignment_id IS NOT NULL;
