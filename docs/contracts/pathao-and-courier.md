# Pathao and courier

## Pathao merchant settings

Buyer destination collection and the controlled public catalog are documented in
[the Pathao location contract](../pathao-location-contract.md). Written-address fallback
preserves payment claims while unresolved locations continue to block booking.

Shop-scoped, environment-specific connection/default management is documented in
[the Pathao settings contract](../pathao-account-contract.md). It uses write-only
encrypted credentials and immutable optimistic revisions. These settings do not
submit bookings or remove draft readiness blockers by themselves.

## Local courier proposals

`GET /api/seller/orders/{order_id}/courier-draft` requires the owning seller.
Returns `CourierDraft`: order identity, creation time, `status: local_proposal`,
`version`, current recipient name/contact/address, remaining COD in minor units,
optional `parcel_weight_grams`/`parcel_quantity`, ordered
`missing_parcel_fields` (`weight`, `quantity`), and blockers.
Order creation accepts the same optional parcel fields; omitted values are not
guessed. Confirmation copies them into the editable draft. Draft edits do not
change agreed order terms, the accepted advance, or remaining COD.

`PATCH /api/seller/orders/{order_id}/courier-draft` requires the owning seller,
`Idempotency-Key`, and `{expected_version, parcel_weight_grams?, parcel_quantity?}`.
At least one parcel field is required; omitted fields are unchanged and explicit
null is rejected. Weight is a positive integer no greater than 1000000 grams;
quantity is a positive integer no greater than 10000. Only confirmed orders are
editable. Same key and payload replay the stored response; a reused key with a
different payload returns 409 `IDEMPOTENCY_KEY_REUSED`; a stale version returns
409 `STALE_VERSION`; foreign/missing orders return 404.

Submission is a separate protected operation; see
[the submission contract](../pathao-submission-contract.md). Any missing parcel field
sets `PARCEL_DETAILS_REQUIRED`; merchant connection/pickup store and Pathao
location IDs always block booking. Cancelled orders additionally return
`ORDER_NOT_CONFIRMED`.

Both confirmation paths insert one unique order-level creation marker within the
allocation transaction (migration 0019). GET projects the current retained buyer
revision and accepted allocation rather than storing another copy of personal
data. COD uses the accepted receipt amount, including exceptions and zero COD.
Existing overpayment checks remain enforced. No provider is contacted. The offline
adapter has the same uniqueness behavior but is intentionally process-local.

Responses are private/no-store. Foreign/missing orders or absent drafts return 404;
retained-away orders return 410. Structured retention deletes the creation marker
and source personal data. Reconciliation retries use a savepoint so failed local
allocation writes cannot discard the enclosing submission and report false success.
The seller proposal uses the shared session request guard, hides previous identities
immediately, rejects late responses, and reloads when the order version changes.

## Courier reconciliation

`POST /api/seller/orders/{order_id}/courier-reconciliation` resolves an `unknown`
submission attempt and requires the owning seller plus `Idempotency-Key`. The body is
`{attempt_id, expected_version, action}`. `attach_existing` also requires
`environment`, `consignment_id`, and `merchant_order_id`; the courier adapter must
confirm the consignment for that shop, order reference, and environment with the
current connection. Sandbox uses `/aladdin/api/v1/orders/{consignment_id}/info`;
the pickup store is compared only when the provider returns it.
`confirm_noncreation` records an explicit seller confirmation and requires no
consignment fields. Responses use the existing `CourierReview` shape.

Successful resolution preserves the attempt's reviewed snapshot, increments
`resolution_version`, and appends a `courier_reconciliations` audit row containing
the actor, action, timestamp, resulting status, and safe evidence references. An
existing consignment cannot be attached to another order. Stale versions and
already-resolved attempts return conflicts; same-key replay returns the current
authorized review, including later local changes, without repeating the resolution.
The resolution, audit, and replay receipt commit atomically. If review
rendering fails after commit, the same key resumes it; concurrent renders preserve
the first saved response as the operation receipt. Submission retries also project
the current authorized review without repeating booking. Rendering a replay can fail
if current facts or metadata are unavailable; the committed operation remains intact.
Different input with the same key returns
`409 IDEMPOTENCY_KEY_REUSED`. The retry path is the normal submission reservation, which revalidates
lifecycle, review freshness, connection, address, and parcel details. Full details
are in [the submission contract](../pathao-submission-contract.md).

## Courier post-submission changes

When a seller corrects delivery details (`PATCH /api/seller/orders/{order_id}/buyer-details`) or
cancels an order (`POST /api/seller/orders/{order_id}/decisions`) after courier submission has been
reserved, in flight, unknown, or accepted, the original booking snapshot, attempt history, and
consignment association remain intact. No provider modification or cancellation is initiated.
`CourierReview` includes nullable `delivery_mismatch`:
- `mismatch` (boolean), `cancelled` (boolean), `recipient_name_changed` (boolean),
  `contact_number_changed` (boolean), `address_changed` (boolean), `changed_fields` (string array),
  `booked_snapshot` (`CourierBookingSnapshot`), and `message` directing the seller to resolve in Pathao.
- The mismatch notice is preserved across in-flight completion and delayed reconciliations.
- Corrections before reservation invalidate stale review approval (`reviewed_token` cleared);
  cancellation before reservation blocks submission (`409 INVALID_LIFECYCLE`).
