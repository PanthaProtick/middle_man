-- Create allocations, used payment markers, audit events and review reasons
-- Ticket 05: Confirm exact payment matches safely

CREATE TABLE IF NOT EXISTS allocations (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
    transaction_id VARCHAR(36) NOT NULL REFERENCES received_transactions(id),
    accepted_amount_minor BIGINT NOT NULL,
    basis VARCHAR(32) NOT NULL DEFAULT 'automatic',
    actor VARCHAR(128) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_allocations_order_id UNIQUE (order_id),
    CONSTRAINT uq_allocations_transaction_id UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS ix_allocations_shop_id ON allocations(shop_id);
CREATE INDEX IF NOT EXISTS ix_allocations_order_id ON allocations(order_id);
CREATE INDEX IF NOT EXISTS ix_allocations_transaction_id ON allocations(transaction_id);

CREATE TABLE IF NOT EXISTS used_payment_markers (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    provider VARCHAR(32) NOT NULL,
    transaction_digest VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_used_payment_markers_digest UNIQUE (shop_id, provider, transaction_digest)
);

CREATE INDEX IF NOT EXISTS ix_used_payment_markers_lookup ON used_payment_markers(shop_id, provider, transaction_digest);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    aggregate_type VARCHAR(32) NOT NULL,
    aggregate_id VARCHAR(36) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_audit_events_aggregate ON audit_events(shop_id, aggregate_type, aggregate_id);

CREATE TABLE IF NOT EXISTS order_review_reasons (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
    reason VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_order_review_reason UNIQUE (order_id, reason)
);

CREATE INDEX IF NOT EXISTS ix_order_review_reasons_order_id ON order_review_reasons(order_id);
