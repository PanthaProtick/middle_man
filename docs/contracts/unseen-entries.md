# Unseen seller entries

`GET /api/seller/unseen-entries` requires seller authentication and resolves the
shop from the authenticated owner. A missing shop returns 404.

Optional query parameters `orders_since`, `payments_since`, and `accounts_since`
are timezone-aware ISO timestamps. Invalid or timezone-naive values return 422.
An omitted parameter returns zero for that section, allowing a first-visit
baseline without treating historical records as notifications.

The response contains integer `orders`, `payments`, and `accounts` counts plus
the UTC server timestamp `captured_at`. Counts include records with
`since < created_at <= captured_at`, across the entire shop, independent of list
filters or pagination. Retained orders and payments are excluded. Account edits
and order/payment status changes do not create new-entry notifications.

The workspace saves only last-seen timestamps in browser local storage, keyed by
shop ID. Opening a section clears its badge immediately; successful reads advance
its timestamp using server time. The active section remains clear. First visits
baseline all sections. Zero counts have no badge. Counts refresh after list changes,
on window focus, and every minute while the workspace is ready. Failed count reads
hide badges and preserve acknowledgements for retry. Late responses are discarded.

Acknowledgements persist across reloads in that browser; they do not sync across
devices. If storage is blocked, they last for the mounted workspace only. Clearing
browser storage resets the baseline. This is a tab-visit indicator, not a record
of which individual rows a seller read, including when a list is filtered.
