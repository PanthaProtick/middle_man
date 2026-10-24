-- Migration 0011: Order replacement and outcomes
-- Ticket 11: Cancel, reject or replace an order

ALTER TABLE orders ADD COLUMN IF NOT EXISTS predecessor_order_id VARCHAR(36) REFERENCES orders(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS replaced_by_order_id VARCHAR(36) REFERENCES orders(id);

CREATE INDEX IF NOT EXISTS ix_orders_predecessor_order_id ON orders(predecessor_order_id);
CREATE INDEX IF NOT EXISTS ix_orders_replaced_by_order_id ON orders(replaced_by_order_id);
