-- Preserve observed identity independently of later receipt corrections.
ALTER TABLE transaction_observations ADD COLUMN provider VARCHAR(32);
ALTER TABLE transaction_observations ADD COLUMN trx_id VARCHAR(128);
UPDATE transaction_observations AS observation
SET provider = receipt.provider, trx_id = receipt.trx_id
FROM received_transactions AS receipt WHERE receipt.id = observation.transaction_id;
ALTER TABLE transaction_observations ALTER COLUMN provider SET NOT NULL;
ALTER TABLE transaction_observations ALTER COLUMN trx_id SET NOT NULL;
CREATE INDEX ix_observation_identity ON transaction_observations (shop_id, provider, trx_id, transaction_id);
