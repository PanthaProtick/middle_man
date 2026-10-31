# Daily shop metrics

`GET /api/seller/metrics/today` requires the seller identity and resolves its
shop server-side. A missing shop returns 404; an unauthenticated request returns
401. No shop ID, search, pagination, or list filter is accepted.

The response contains `date` (YYYY-MM-DD), `timezone` (`Asia/Dhaka`), and integer
counts: `orders`, `confirmed`, `awaiting`, `pending`, `payments`, and `staged_for_delivery`.

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

`staged_for_delivery` counts orders created today in Bangladesh time: confirmed, non-retained orders with a
local courier draft and no submitting, successful, or unknown booking attempt.
Definitively failed attempts remain eligible. Parcel details and courier review
may still be required. The count remains shop-isolated.

Seller order list and detail responses include `delivery_staged`, derived from
the same draft and attempt rules regardless of creation date. It is a label,
not a manually editable lifecycle or a guarantee of courier readiness.
