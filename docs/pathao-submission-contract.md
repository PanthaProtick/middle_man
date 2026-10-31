# Courier submission contract

2026-10-31: [Production trial opt-in](pathao-production-trial.md) supersedes the
production rejection described below. New production bookings default to disabled;
production consignment lookup remains available for recovery even when disabled.

Seller-only `POST /api/seller/orders/{id}/courier-submission` executes the protected
submission workflow against the selected offline or Pathao sandbox connection.
Production submission remains disabled and is rejected server-side.

## Sandbox transport

- Base URL `https://courier-api-sandbox.pathao.com`; credentials come from the
  reviewed sandbox connection revision. Production (`api-hermes.pathao.com`) is
  never used by a submission.
- Authentication is a password grant to `/aladdin/api/v1/issue-token`. The token is
  held only for that operation and discarded; no refresh or persistence occurs.
- Create order is a single `POST /aladdin/api/v1/orders` per attempt. HTTP transport
  retries are disabled, redirects are not followed, and application code does not
  replay it. The complete operation has a 15-second deadline with 10-second read
  and 4-second connect timeouts.
- Payload uses server-derived facts: store ID, order ID as `merchant_order_id`,
  canonical recipient name/phone/address, the resolved city/zone/area IDs, service
  `48`/`12`, item type `2` (parcel), integer quantity, weight in kg, and exact
  whole-taka COD. Non-whole-taka COD, out-of-contract names/phones/addresses,
  weights outside 0.5–10 kg, unresolved destinations, and unsupported service codes
  are rejected before any network call rather than rounded, guessed, or substituted.
- `200`/`201` with a consignment ID is success. `400`, `401`, `403`, `404`, `422`,
  and `429` are definitive noncreation rejections only after no create-order call is
  retried. Timeouts, connection errors, redirects, other statuses, malformed bodies,
  and mismatched returned merchant references are ambiguous and must remain
  `unknown`; success is never inferred from an HTTP status alone.
- The credentials are loaded after the attempt reservation commits and the
  connection revision must still match the reviewed snapshot. Provider I/O never
  runs inside a database transaction.

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
     token), absence of readiness blockers, store membership, and environment (`offline` or
     `sandbox`; production is rejected with `REAL_BOOKING_DISABLED`).
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
   - **Success**: Offline returns a simulated consignment ID (`SIM-PATHAO-...`); sandbox returns
     the provider consignment ID. Persists `status = 'success'`, updates consignment association
     and snapshot, caches idempotency record.
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
  Sandbox verifies `GET /aladdin/api/v1/orders/{consignment_id}/info` with the current
  sandbox connection: consignment and merchant order references must match, and the pickup
  store is compared only when the provider returns it. Consignment lookup fields the provider
  does not expose are not claimed as verified.
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

- **Zero live network calls in tests**: Ordinary tests reject external sockets and use
  `httpx.MockTransport` at the provider boundary.
- **Sandbox transport, production disabled**: Sandbox booking can be selected only with a
  verified sandbox connection. Production submission is rejected with
  `REAL_BOOKING_DISABLED` before provider I/O.
- **Provider acceptance disclaimer**: Mocked transport tests prove request mapping,
  classification, and the absence of automatic create-order replay. They do not prove
  that Pathao sandbox accepted a live request. An actual sandbox booking requires verified
  account-owned sandbox credentials and a usable test store, and is recorded separately.
