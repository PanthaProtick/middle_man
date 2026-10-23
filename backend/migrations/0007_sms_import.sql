-- Raw bodies can be erased independently of structured results and deduplication.
CREATE TABLE sms_evidence (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    owner_id VARCHAR(128) NOT NULL,
    text_digest VARCHAR(64) NOT NULL,
    raw_text TEXT,
    collected_at TIMESTAMPTZ NOT NULL,
    delete_after TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_sms_evidence_digest UNIQUE (shop_id, text_digest),
    CONSTRAINT sms_original_deadline CHECK (delete_after = collected_at + INTERVAL '30 days')
);
CREATE INDEX ix_sms_evidence_deadline ON sms_evidence(delete_after);
CREATE TABLE sms_imports (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    mutation_key VARCHAR(128) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    result_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_sms_import_key UNIQUE (shop_id, mutation_key)
);
CREATE INDEX ix_sms_import_shop_created ON sms_imports(shop_id, created_at, id);
