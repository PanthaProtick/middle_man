# Offline courier submission contract

Seller-only `POST /api/seller/orders/{id}/courier-submission` executes the protected
submission workflow against the offline courier adapter. Real and production booking
is unavailable and rejected server-side.

## Idempotency and payload contract

- Requires header `Idempotency-Key` (1–64 characters).
- Accepts JSON payload `expected_token` matching the 64-hex SHA-256 review fingerprint.
- Returns `CourierReview` containing `latest_attempt` (status, simulated consignment,
  booking snapshot, error information).
- Same-key replay preserves the committed operation receipt and returns the current
  authorized review, including later delivery changes and cancellation warnings. It never
  submits again. Different idempotency keys or
  repeated clicks cannot bypass an existing in-flight, unknown, or booked attempt.

## Reservation and transaction boundaries

1. **Preflight rechecks (Transaction 1, with row locks):**
   - Locks shop, order, and draft (`with_for_update`).
   - Revalidates order lifecycle (`confirmed`), review freshness (`expected_token` matches current
     token), absence of readiness blockers, store membership, and environment (`offline`).
   - Rejects if an active booking (`success`), protected unknown outcome (`unknown`), or
     in-flight attempt (`submitting`) exists for the order.
   - Snapshots the reviewed payload (recipient contact, address, location hierarchy, store,
     service, parcel weight/quantity, and integer BDT COD).
   - Persists the attempt record with `status = 'submitting'` before any external provider call.
   - Commits Transaction 1 and releases database locks.

2. **Provider execution (Outside database transactions):**
   - Dispatches mapped request to `pathao_provider.submit_booking`.
   - Never holds an open database connection or transaction across external I/O.
   - Formats recipient phone from canonical buyer contact (not payer number), explicit parcel
     weight/quantity, and exact minor-unit COD conversion (integer BDT `remaining_cod_minor // 100`,
     zero collection for fully prepaid orders, overpayment rejection).

3. **Outcome persistence (Transaction 2):**
   - **Success**: Provider returns valid simulated consignment ID (`SIM-PATHAO-...`). Persists
     `status = 'success'`, updates consignment association and snapshot, caches idempotency record.
   - **Definitive failure**: Provider definitively rejects request (e.g. inactive store / validation
     failure). Persists `status = 'failed'` with error details. Draft remains editable and retryable.
   - **Unknown outcome**: Provider timeout, network disconnect, malformed response, or provider
     acceptance followed by local DB persistence failure. Classified conservatively as `status = 'unknown'`.
     Further submission attempts and draft edits are strictly blocked until reconciled.

## Unknown-outcome reconciliation

Seller-only `POST /api/seller/orders/{id}/courier-reconciliation` resolves one protected
`unknown` attempt. It requires `Idempotency-Key` and
`{attempt_id, expected_version, action}`.

- `action = attach_existing` additionally requires `environment`, `consignment_id`, and
  `merchant_order_id`. The offline adapter verifies that the consignment belongs to the
  authenticated shop, the order reference, the selected store, and the attempt environment.
  A missing, foreign, or mismatched consignment leaves the attempt `unknown` and returns a
  controlled `422 EVIDENCE_UNAVAILABLE`/`EVIDENCE_MISMATCH`. One consignment cannot be
  associated with another order (`409 CONSIGNMENT_ALREADY_ASSOCIATED`).
- `action = confirm_noncreation` records an explicit seller confirmation that no booking
  exists. It changes only the attempt to `failed`/`CONFIRMED_NONCREATION`; an empty merchant
  panel, timeout, or absent local row is never inferred as noncreation.
- Both actions preserve the original attempt, reviewed token, correlation ID, and booking
  snapshot. They increment `resolution_version` and write an attributable
  `courier_reconciliations` row (actor, action, timestamp, resulting state, and non-secret
  reference/evidence fields). Other attempts for the order are untouched.
- Stale versions return `409 STALE_VERSION`; an already-resolved attempt returns
  `409 ATTEMPT_NOT_RECONCILABLE`. Same-key replay returns the current authorized review
  without applying the resolution again. Competing
  operators serialize on the order/shop/attempt locks, so only one resolution is recorded.
  The attempt, audit, and idempotency receipt commit together. Review rendering happens
  after releasing locks; if it fails, the same key resumes rendering from the committed
  receipt without applying another resolution. The first successfully persisted review
  is retained as the operation receipt, including when simultaneous requests render it.
  Replays project current facts so a later local change or newer attempt cannot be hidden
  by a historical response. Reusing the
  key with different input returns `409 IDEMPOTENCY_KEY_REUSED`. The seller UI retains
  the key when retrying the same action and evidence after an interrupted response.
- A confirmed noncreation permits a new attempt only after the normal reservation rechecks
  current lifecycle, reviewed revision, connection, address, and parcel facts. Cancelling
  the order still blocks a new booking. An existing booking can still be attached after a
  local cancellation, retaining the order-state blockers (including cancellation).
  Recovered success on an order that is no longer confirmed also explicitly warns that
  local cancellation does not cancel the Pathao booking and requires action in Pathao.
- Provider I/O runs outside the database transaction. Settings changes, draft edits,
  reconnects, or a different idempotency key cannot bypass the protected attempt.

## Post-submission changes and mismatch detection

- Before external submission, seller delivery corrections (`PATCH /buyer-details`) refresh the draft
  and invalidate stale review approval. Pre-submission order cancellation (`POST /decisions`) sets
  `lifecycle = 'cancelled'`, blocks reservation (`INVALID_LIFECYCLE`), and prevents submission calls.
- Once submission is in flight (`submitting`), outcome unknown (`unknown`), or accepted (`success`),
  the reviewed booking snapshot, consignment association, and attempt ledger remain intact.
- Local delivery corrections or order cancellations never claim to modify or cancel a Pathao booking,
  and never silently trigger amendment, replacement, or cancellation requests to the provider.
- When an order is cancelled or delivery details (recipient name, contact number, address) are corrected
  after submission or while submission is in flight, `CourierReview` exposes typed `delivery_mismatch`:
  - `mismatch: true`, with booleans `cancelled`, `recipient_name_changed`, `contact_number_changed`,
    `address_changed`, machine-readable `changed_fields`, `booked_snapshot`, and seller action message.
  - When in-flight submissions finish or delayed reconciliations attach an existing consignment, the
    mismatch/action notice is preserved rather than overwritten by a generic success result.
  - Unrelated edits (such as audit notes without delivery changes) do not fabricate a delivery mismatch.
- An unknown attempt remains protected after local correction or cancellation. Resolving a local change
  does not erase uncertainty or create a duplicate booking opportunity.

## Invariant and restart protections

- Rejection messages stored in attempts and returned to sellers use controlled
  application text. Raw provider exception text is never persisted or returned;
  definitive noncreation remains editable/retryable with `COURIER_REJECTED`.

- Process crash or restart while in `submitting` status recovers conservatively as `unknown`.
- Editing draft parcel details or changing connection defaults is blocked while an attempt is
  in-flight, booked, or unknown.
- Tenancy boundaries enforce that only the owning shop's authenticated seller can submit or view attempts.


## Verification and acceptance boundaries

- **Zero live network calls**: Ordinary tests reject all external socket connections (`reject_network` fixture).
- **Offline adapter only**: Real and production booking remains unavailable and rejected server-side (`REAL_BOOKING_DISABLED`).
- **Provider acceptance disclaimer**: External courier provider acceptance is NOT established by this ticket; Ticket 06 delivers only authenticated seller submission actions and UI progress/result states against the offline courier simulation.
