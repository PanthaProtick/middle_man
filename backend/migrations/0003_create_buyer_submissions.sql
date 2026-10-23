-- Migration 0003: Create buyer_revisions and link_measurements tables
-- Supports manual buyer details submission, aggregate measurements, and immutable revision history

ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_revision INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS first_submitted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS buyer_revisions (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    buyer_name VARCHAR(200) NOT NULL,
    contact_number_raw VARCHAR(32) NOT NULL,
    contact_number_canonical VARCHAR(20) NOT NULL,
    address_raw TEXT NOT NULL,
    address_district VARCHAR(100),
    address_thana VARCHAR(100),
    address_area VARCHAR(100),
    address_street_line VARCHAR(200),
    address_landmark VARCHAR(200),
    payment_provider VARCHAR(32) NOT NULL,
    payment_trx_id VARCHAR(128) NOT NULL,
    payment_sender_raw VARCHAR(32) NOT NULL,
    payment_sender_canonical VARCHAR(20) NOT NULL,
    payment_amount_minor INTEGER NOT NULL,
    payment_claimed_at TIMESTAMPTZ,
    payment_evidence_id VARCHAR(64),
    source VARCHAR(32) NOT NULL DEFAULT 'buyer',
    actor VARCHAR(32) NOT NULL DEFAULT 'buyer',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buyer_revisions_order_id ON buyer_revisions(order_id);

CREATE TABLE IF NOT EXISTS link_measurements (
    id VARCHAR(36) PRIMARY KEY,
    token_lookup_digest VARCHAR(64) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    is_bot_or_repeat BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_link_measurements_token_digest ON link_measurements(token_lookup_digest);
