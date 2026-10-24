-- Bound recent export-budget admission and newest-first same-shop export scans.
CREATE INDEX ix_audit_order_export_budget ON audit_events (shop_id, created_at)
WHERE action = 'order_export';
CREATE INDEX ix_orders_shop_export ON orders (shop_id, created_at DESC, id DESC);
