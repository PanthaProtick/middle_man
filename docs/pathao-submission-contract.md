# Offline courier submission contract

Seller-only `POST /api/seller/orders/{id}/courier-submission` executes the protected
submission workflow against the offline courier adapter. Real and production booking
is unavailable and rejected server-side.

## Idempotency and payload contract

- Requires header `Idempotency-Key` (1–64 characters).
- Accepts JSON payload `expected_token` matching the 64-hex SHA-256 review fingerprint.
- Returns `CourierReview` containing `latest_attempt` (status, simulated consignment,
  booking snapshot, error information).
- Same-key replay returns the cached status and payload. Different idempotency keys or
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
