-- Immutable, shop- and environment-scoped connection/settings revisions.
CREATE TABLE pathao_connection_revisions (
    shop_id VARCHAR(36) NOT NULL REFERENCES shops(id),
    environment VARCHAR(16) NOT NULL CHECK (environment IN ('offline', 'sandbox', 'production')),
    version INTEGER NOT NULL CHECK (version > 0),
    encrypted_credentials TEXT,
    default_store_id INTEGER CHECK (default_store_id > 0),
    default_delivery_type INTEGER CHECK (default_delivery_type IN (48, 12)),
    PRIMARY KEY (shop_id, environment, version),
    CHECK ((environment = 'offline' AND encrypted_credentials IS NULL)
        OR (environment <> 'offline' AND encrypted_credentials IS NOT NULL))
);
