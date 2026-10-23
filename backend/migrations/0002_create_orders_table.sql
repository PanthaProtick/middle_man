-- Migration 0002: Create Orders Table
-- Ticket 02: Create an order and retrieve its buyer link

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    payment_account_id VARCHAR(36) NOT NULL REFERENCES payment_accounts(id),
    token_lookup_digest VARCHAR(64) NOT NULL UNIQUE,
    encrypted_portal_token TEXT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    total_minor INTEGER NOT NULL,
    required_advance_minor INTEGER NOT NULL,
    account_provider VARCHAR(32) NOT NULL,
    account_receiving_number VARCHAR(20) NOT NULL,
    account_label VARCHAR(200) NOT NULL,
    lifecycle VARCHAR(32) NOT NULL DEFAULT 'awaiting_buyer',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS ix_orders_payment_account_id ON orders(payment_account_id);
CREATE INDEX IF NOT EXISTS ix_orders_token_lookup_digest ON orders(token_lookup_digest);
CREATE INDEX IF NOT EXISTS ix_orders_lifecycle ON orders(lifecycle);
