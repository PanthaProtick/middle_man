# Orders, search, and export

## Seller order search, date filter and export

`GET /api/seller/orders` and `GET /api/seller/orders/export` accept one optional
`search` term (maximum 200 characters, trimmed). Within the seller's shop it
matches an exact case-insensitive order ID, partial case-insensitive product or
current buyer name, or a complete Bangladesh buyer contact number normalized
across `017…`, `88017…`, and `+88017…` formats. Short numeric fragments never
match phone fields. Search combines with the lifecycle filter using AND, excludes
retained orders, and is applied before list pagination and the CSV's 500-order
limit.

Both routes also accept optional `from_date` and `to_date` values in `YYYY-MM-DD`
form. Each is an inclusive Bangladesh (`Asia/Dhaka`) calendar date applied to the
order's creation time; `from_date` starts at Dhaka midnight and `to_date` ends at
the following Dhaka midnight, converted to UTC. A future `to_date` is valid,
either bound may be omitted, and a reversed range returns `422
INVALID_DATE_RANGE` while a malformed date returns `422 VALIDATION_ERROR`. The
date bounds combine with search, lifecycle, retained exclusion, and shop scoping
using AND, and are applied before list pagination and the CSV's 500-order limit.
Clients resolve relative presets to concrete dates before requesting, so paging
and export reuse the same boundaries.

The CSV preserves English columns, escaping, private/no-store headers,
rate limiting, and returns `EXPORT_TOO_LARGE` instead of truncating above 500
matches. Search text and date values are request-only and are not logged or
persisted in URLs.
