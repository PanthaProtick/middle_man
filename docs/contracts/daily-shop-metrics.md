# Daily shop metrics

`GET /api/seller/metrics/today` requires the seller identity and resolves its
shop server-side. A missing shop returns 404; an unauthenticated request returns
401. No shop ID, search, pagination, or list filter is accepted.

The response contains `date` (YYYY-MM-DD), `timezone` (`Asia/Dhaka`), and integer
counts: `orders`, `confirmed`, `awaiting`, `pending`, and `payments`.

Today means Bangladesh midnight inclusive through the next midnight exclusive.
Orders count by creation time; payments count unique received transactions by
recorded time, regardless of when the transfer occurred. Retained records are
excluded, matching seller lists. Status counts describe current lifecycle for
orders created today, rather than transitions that occurred today. Expired
awaiting-buyer orders are excluded from `awaiting`, matching order-list behavior.

SQL aggregates all qualifying rows without pagination. Offline mode applies the
same bounds and shop isolation to memory stores. The frontend refreshes after
list updates, on window focus, and every minute, including across midnight.
Unavailable counts display a dash rather than a fabricated zero.
