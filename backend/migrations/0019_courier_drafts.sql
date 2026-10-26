-- Durable creation work; recipient and COD are projected from retained source records.
CREATE TABLE courier_drafts (
    order_id VARCHAR(36) PRIMARY KEY REFERENCES orders(id),
    created_at TIMESTAMPTZ NOT NULL
);
