-- Migration 0016: Raw evidence cleanup tracking
-- Ticket 18: Run raw-evidence cleanup and expose failures

CREATE TABLE IF NOT EXISTS evidence_cleanups (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) REFERENCES shops(id),
    ran_at TIMESTAMPTZ NOT NULL,
    items_purged INTEGER NOT NULL DEFAULT 0,
    items_failed INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS ix_evidence_cleanups_shop_id ON evidence_cleanups(shop_id);
CREATE INDEX IF NOT EXISTS ix_evidence_cleanups_ran_at ON evidence_cleanups(ran_at);
