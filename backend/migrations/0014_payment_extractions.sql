-- Raw AI evidence belongs to its order/shop; replay never extends its deadline.
CREATE TABLE payment_extractions (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
    mutation_key VARCHAR(64) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    state VARCHAR(16) NOT NULL CHECK (state IN ('pending', 'complete')),
    result_json TEXT NOT NULL,
    evidence_id VARCHAR(36) NOT NULL REFERENCES order_evidence(id),
    raw_response TEXT,
    collected_at TIMESTAMPTZ NOT NULL,
    delete_after TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_payment_extraction_key UNIQUE (order_id, mutation_key),
    CONSTRAINT payment_raw_deadline CHECK (delete_after = collected_at + INTERVAL '30 days')
);
CREATE INDEX ix_payment_extractions_order_id ON payment_extractions(order_id);
CREATE INDEX ix_payment_extractions_shop_id ON payment_extractions(shop_id);
CREATE INDEX ix_payment_extractions_delete_after ON payment_extractions(delete_after);
