-- Create received transactions and observations tables
-- Ticket 04: Record and inspect received payments manually

CREATE TABLE IF NOT EXISTS received_transactions (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    payment_account_id VARCHAR(36) NOT NULL REFERENCES payment_accounts(id),
    provider VARCHAR(32) NOT NULL,
    trx_id VARCHAR(128) NOT NULL,
    amount_minor BIGINT NOT NULL,
    sender_number_raw VARCHAR(32),
    sender_number_canonical VARCHAR(20),
    occurred_at TIMESTAMP WITH TIME ZONE,
    reconciliation_state VARCHAR(32) NOT NULL DEFAULT 'unmatched',
    has_conflict BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_received_transactions_identity UNIQUE (shop_id, provider, trx_id)
);

CREATE INDEX IF NOT EXISTS ix_received_transactions_shop_id ON received_transactions(shop_id);
CREATE INDEX IF NOT EXISTS ix_received_transactions_payment_account_id ON received_transactions(payment_account_id);
CREATE INDEX IF NOT EXISTS ix_received_transactions_trx_id ON received_transactions(trx_id);
CREATE INDEX IF NOT EXISTS ix_received_transactions_reconciliation_state ON received_transactions(reconciliation_state);

CREATE TABLE IF NOT EXISTS transaction_observations (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    transaction_id VARCHAR(36) NOT NULL REFERENCES received_transactions(id),
    payment_account_id VARCHAR(36) NOT NULL REFERENCES payment_accounts(id),
    source VARCHAR(32) NOT NULL DEFAULT 'manual',
    actor VARCHAR(128) NOT NULL,
    amount_minor BIGINT NOT NULL,
    sender_number_raw VARCHAR(32),
    sender_number_canonical VARCHAR(20),
    occurred_at TIMESTAMP WITH TIME ZONE,
    parse_state VARCHAR(32) NOT NULL DEFAULT 'valid',
    conflict_state VARCHAR(32) NOT NULL DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_transaction_observations_shop_id ON transaction_observations(shop_id);
CREATE INDEX IF NOT EXISTS ix_transaction_observations_transaction_id ON transaction_observations(transaction_id);
CREATE INDEX IF NOT EXISTS ix_transaction_observations_payment_account_id ON transaction_observations(payment_account_id);
