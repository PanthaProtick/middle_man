CREATE TABLE payment_metrics (
    shop_id varchar(36) PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
    confirmed_count bigint NOT NULL DEFAULT 0 CHECK (confirmed_count >= 0),
    manual_count bigint NOT NULL DEFAULT 0 CHECK (manual_count >= 0),
    exception_count bigint NOT NULL DEFAULT 0 CHECK (exception_count >= 0)
);
INSERT INTO payment_metrics (shop_id, confirmed_count, manual_count, exception_count)
SELECT a.shop_id, count(*), count(*) FILTER (WHERE a.basis = 'manual'),
       count(*) FILTER (WHERE a.basis = 'manual' AND EXISTS (
           SELECT 1 FROM audit_events e WHERE e.shop_id = a.shop_id
           AND e.aggregate_id = a.order_id AND e.action = 'order_confirmed_manual'
           AND jsonb_array_length(e.details::jsonb->'exceptions') > 0))
FROM allocations a GROUP BY a.shop_id;
