-- Migration 0012: Private screenshot evidence records
-- Ticket 13: Attach optional screenshots privately

CREATE TABLE IF NOT EXISTS order_evidence (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
    storage_key VARCHAR(255) NOT NULL,
    media_type VARCHAR(32) NOT NULL,
    byte_size INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    sha256_digest VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'staged',
    collected_at TIMESTAMPTZ NOT NULL,
    delete_after TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_order_evidence_shop_id ON order_evidence(shop_id);
CREATE INDEX IF NOT EXISTS ix_order_evidence_order_id ON order_evidence(order_id);
CREATE INDEX IF NOT EXISTS ix_order_evidence_delete_after ON order_evidence(delete_after);
CREATE INDEX IF NOT EXISTS ix_order_evidence_status ON order_evidence(status);
