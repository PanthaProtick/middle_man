-- Migration 0024: Courier submission attempts and booking snapshots
CREATE TABLE IF NOT EXISTS courier_attempts (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    attempt_number INTEGER NOT NULL,
    environment VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    reviewed_token VARCHAR(64) NOT NULL,
    correlation_id VARCHAR(64) NOT NULL,
    consignment_id VARCHAR(64),
    booking_snapshot JSONB,
    error_code VARCHAR(64),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_courier_attempts_order_number UNIQUE (order_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS ix_courier_attempts_shop_id ON courier_attempts(shop_id);
CREATE INDEX IF NOT EXISTS ix_courier_attempts_order_id ON courier_attempts(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_attempts_consignment ON courier_attempts(consignment_id) WHERE consignment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_attempts_booked_order ON courier_attempts(order_id) WHERE status = 'success';
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_attempts_active_order ON courier_attempts(order_id) WHERE status IN ('submitting', 'unknown');
