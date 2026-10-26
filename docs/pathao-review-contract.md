# Local courier review

Seller-only `GET /api/seller/orders/{id}/courier-review` combines the current
buyer, parcel, accepted-allocation COD, connection, pickup store and delivery
service. `blockers` is the authoritative combined readiness list. The existing
`courier-draft` endpoint remains the parcel editor; its legacy blockers do not
represent the combined review state.

`PUT` on the review resource accepts `expected_token`, `environment`, `store_id`,
`delivery_type` (48 normal or 12 on-demand), and a `location` selection. It saves
local choices on the existing draft and increments its version. Incomplete or
invalid membership/coverage choices remain editable but cannot be approved.
There is no client COD field. Saved connection defaults are suggestions until
overridden; explicit draft choices survive subsequent default changes.

`GET .../courier-review/locations` requires the selected environment and
`expected_version` of its connection, with optional city/zone parent IDs.
Catalog reads validate parent relationships and recheck ownership, retention
and settings after provider I/O. Unknown coverage and empty area lists block
review rather than implying delivery support.

`POST` accepts only `expected_token` and marks the current ready draft reviewed.
The opaque hash binds order identity/version, buyer revision, draft version,
selected choices, environment, settings revision and server-derived COD.
Provider reads finish before acquiring write locks. Approval locks the shop
(also used by settings writes), then the order and draft, and rechecks versions.
Repeated approval of unchanged data is safe and creates neither a draft nor a
booking. Edits, corrections, cancellation and changed settings invalidate the
review. Buyer corrections replace seller destination overrides with the current
buyer destination, conservatively requiring review of that revision.

Only a review hash and noncredential selections are stored in migration 0023;
recipient details remain projected from existing records. Retention access
denial remains authoritative. `submission_enabled` is always false, including
for a completed review. No create-order transport or protected attempt workflow
is introduced by this ticket.
