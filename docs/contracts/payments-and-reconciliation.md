# Payments and reconciliation

## Seller received-payment search

`GET /api/seller/transactions` accepts one optional `search` term (maximum 200
characters, trimmed). Within the seller's shop it matches an exact case-insensitive
provider TrxID, an exact case-insensitive internal receipt ID, a partial
case-insensitive receiving-account label, a complete Bangladesh payment sender
number, or a complete Bangladesh receiving-account number normalized across
`017…`, `88017…`, and `+88017…` formats and Bengali digits. Short numeric
fragments never match phone fields. Raw SMS text and buyer payment claims are not searched. Search
combines with the `review`, `used`, and `parse` reconciliation filters using AND,
excludes retained records, and is applied before pagination in both database and
offline paths. Search terms are request-only and are not logged or persisted in
URLs.

The same transaction list accepts optional `from_date` and `to_date` inclusive
Bangladesh calendar dates (`YYYY-MM-DD`), applied to record `created_at`, including
records without `occurred_at`. The end boundary is the following Dhaka midnight.
Malformed or reversed ranges return 422; future end dates and individual bounds
are supported. Date, search, and reconciliation predicates apply before keyset
pagination on both database and offline paths. The inbox captures Last X days
(1–3650, including today) as explicit dates and reuses them while paging.
Accepted payment history within an order is unaffected.

## Seller receipt comparison and resolution

- `GET /api/seller/transactions/{id}` returns the owning seller's receipt observations,
  same-shop claim comparisons and review reasons, accepted order ID, and decision history.
- `POST /api/seller/transactions/{id}/resolve` requires `Idempotency-Key`,
  `expected_version`, `reason`, `selected_observation_id`, and optionally
  `selected_order_id`. Unknown write fields are rejected. Selection never overrides
  exact-match requirements. Selecting an order explicitly holds other current claim
  revisions; selecting observations alone leaves competing claims unresolved.
- Same key/payload replays the committed response; changed payload or stale version
  returns 409. New claims change receipt version. Retry an unknown outcome with the
  identical key/payload; refetch stale comparisons before a new decision.
- Used allocations are immutable. Later contradictions remain seller alerts. All
  receipt comparison and mutation responses, including errors, use private/no-store
  headers. Buyer projections expose no decision reasons or competing-claim identities.
- Literal SMS endpoints are registered before the dynamic receipt-ID endpoint.

## Unallocated receipt corrections

- `PATCH /api/seller/transactions/{id}` requires owning-seller identity,
  `Idempotency-Key`, `expected_version`, a nonblank `reason` (max 1000), and at
  least one corrected receipt field. Account/provider/TrxID/amount cannot be null;
  sender/time can explicitly become unknown. Times require a timezone. Unknown
  fields, invalid amounts and cross-shop accounts are rejected.
- Returns `ReceiptComparison` with corrected receipt, related claim outcomes,
  allocation and resolution history plus `corrections`: typed before/after values,
  appended observation ID, actor, reason and time. Original observations stay intact.
- `RECEIPT_IDENTITY_COLLISION` (409) requires comparing and explicitly resolving
  the existing same-shop/provider/TrxID receipt; PATCH never merges identities or
  creates a second spendable receipt. `PAYMENT_USED` locks accepted fields.
- Both old and new pending claims are rechecked with ordinary exact-match rules.
  Corrections cannot select a competing claim or authorize matching exceptions.
- Observation provider/TrxID snapshots prevent resolution from treating an old
  observation as evidence for a corrected identity (`OBSERVATION_IDENTITY_CHANGED`).
  Same-key replay precedes version checks; unknown outcomes retain the exact payload
  and key. Stale versions require refresh before a new correction.
- Retained observation identities also guard ingestion and later corrections. An
  original-identity reimport attaches as conflicting evidence to the same receipt,
  preserving any accepted allocation. Allocation writes minimal used markers for
  every retained identity, so later evidence deletion cannot free an old identity.

## Seller payment exception acceptance

- GET `/api/seller/orders/{id}/payment-preview?transaction_id=...` compares the active
  claim with an existing same-shop receipt and returns exception codes, hard blockers,
  actual COD and both order/receipt versions. Excessive payments have null COD.
- POST `/api/seller/orders/{id}/decisions` supports `action: confirm`, `action: cancel`,
  and `action: reject`.
  - For `action: confirm`: Requires `expected_version`, `expected_transaction_version`,
    `transaction_id`, strict positive `accepted_amount_minor`, nonblank `reason`, and
    `Idempotency-Key`. The accepted amount must equal the full recorded receipt and cannot
    exceed total.
  - For `action: cancel`: Requires `expected_version`, nonblank `reason`, and
    `Idempotency-Key`. Transitions eligible orders to `cancelled`, preserving audit history
    and locking any existing payment allocation and marker without freeing them.
  - For `action: reject`: Requires `expected_version`, nonblank `reason`, and
    `Idempotency-Key`. Available for `pending` orders, projecting a terminal rejected state
    that blocks buyer resubmission. Confirmed orders cannot be rejected.
  This slice does not implement refunds or reassignment.
- Missing authority/ownership returns 401/404; invalid input or partial allocation
  returns 422; stale evidence and allocation blockers return 409. Same-key replay
  returns the committed snapshot; changed payload returns 409. Database write
  failure returns explicit 503 with same-payload/key retry guidance, never fallback
  confirmation. Seller responses remain private/no-store.
- GET `/api/seller/orders/{id}/payment-decisions` exposes owning-seller manual decision
  history: actual advance/COD, exceptions, reason, actor and time. Public buyer
  projections continue hiding receipt details, exception codes and seller reasons.
- GET `/api/seller/payment-summary` returns only confirmed/manual/exception order
  counts for the owning shop. Migration 0010 stores these without personal data,
  receipt/order identifiers or reasons; shared allocation writes counters atomically.
