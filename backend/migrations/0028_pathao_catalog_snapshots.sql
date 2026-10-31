-- Complete catalogues are published in one transaction; incomplete crawls are invisible.
ALTER TABLE pathao_connection_revisions ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE pathao_catalog_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    environment VARCHAR(16) NOT NULL CHECK (environment IN ('offline', 'sandbox', 'production')),
    connection_version INTEGER NOT NULL CHECK (connection_version > 0),
    created_at TIMESTAMPTZ NOT NULL,
    retired_at TIMESTAMPTZ
);
CREATE INDEX ix_pathao_catalog_snapshots_shop_id ON pathao_catalog_snapshots(shop_id);
CREATE UNIQUE INDEX uq_pathao_catalog_active ON pathao_catalog_snapshots
    (shop_id, environment, connection_version) WHERE retired_at IS NULL;
CREATE TABLE pathao_catalog_lists (
    snapshot_id VARCHAR(36) NOT NULL REFERENCES pathao_catalog_snapshots(id) ON DELETE CASCADE,
    level VARCHAR(8) NOT NULL CHECK (level IN ('city', 'zone', 'area')),
    parent_id INTEGER NOT NULL CHECK (parent_id >= 0),
    choices_json TEXT NOT NULL,
    PRIMARY KEY (snapshot_id, level, parent_id)
);
CREATE TABLE pathao_catalog_sync (
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    environment VARCHAR(16) NOT NULL CHECK (environment IN ('offline', 'sandbox', 'production')),
    connection_version INTEGER NOT NULL,
    lease_id VARCHAR(36),
    lease_until TIMESTAMPTZ,
    attempted_at TIMESTAMPTZ,
    failed BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (shop_id, environment)
);
