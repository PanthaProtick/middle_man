-- Raw AI evidence belongs to its order/shop; replay never extends its deadline.
CREATE TABLE address_extractions (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
    mutation_key VARCHAR(64) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    result_json TEXT NOT NULL,
    raw_request TEXT,
    raw_response TEXT,
    collected_at TIMESTAMPTZ NOT NULL,
    delete_after TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_address_extraction_key UNIQUE (order_id, mutation_key),
    CONSTRAINT address_raw_deadline CHECK (delete_after = collected_at + INTERVAL '30 days')
);
CREATE INDEX ix_address_extractions_order_id ON address_extractions(order_id);
CREATE INDEX ix_address_extractions_shop_id ON address_extractions(shop_id);
CREATE INDEX ix_address_extractions_delete_after ON address_extractions(delete_after);
