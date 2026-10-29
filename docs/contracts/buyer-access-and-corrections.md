# Buyer access and corrections

## Same-order buyer-link reissue

`POST /api/seller/orders/{order_id}/reissue-link` requires the owning seller,
`Idempotency-Key`, and `{expected_version}` (strict positive integer; no extra
fields). Returns `SellerOrder` with a fresh saved link and incremented version.
It clears revocation and permanently invalidates previous tokens for all public
operations, including replay. Order identity, terms, allocation, original deadline
and submission state remain unchanged. Expired/cancelled/replaced orders and
unsubmitted orders past the deadline return `409 ORDER_NOT_REISSUABLE`.

Shop/order locks serialize reissue with revocation and public mutations. Token
rotation, audit and retry record commit together. Matching retries return the
original result without rotating; if that token has since been rotated or revoked,
the retry returns `409 BUYER_LINK_SUPERSEDED` and asks the seller to refresh.
Changed-payload key reuse and stale versions conflict. Responses retain private
no-store and no-referrer headers; database failures return the existing uncertain
outcome response, so retry with the same key and payload. The workspace disables
competing access actions while an outcome is unresolved and updates the saved
copy/open link only after acknowledgement.

## Public request admission

Public validation errors keep stable `error.code` and `fields[].code`/`field`
values. `fields[].params` adds only integer `min_length` and `max_length`
constraints for localized presentation; validator context and submitted values
are never copied into these parameters. Other errors have an empty parameter map.
The buyer UI localizes codes and the existing `Retry-After` seconds header, with
safe guidance for unknown failures. Locale changes do not send requests or reset
submission attempts. Bengali digits are accepted when parsing decimal BDT input
to exact integer minor units; names, addresses, TrxIDs and raw phone evidence stay
unchanged. Phones already accept Bengali digits at their validation boundary.

All HTTP requests under `/api/public/orders` share an aggregate fixed-window quota
per application worker, before token lookup, validation or storage access. Defaults
(positive integer environment settings): `PUBLIC_REQUESTS_PER_WINDOW=600`,
`PUBLIC_REQUEST_WINDOW_SECONDS=60`, and `PUBLIC_REQUEST_MAX_BYTES=65536`.
The same bounded request envelope applies to all public operations.

Declared oversized bodies are rejected without reading; all other bodies are read
only up to the configured bound, counting actual bytes regardless of Content-Length,
before route execution. An overflowing chunk is not copied and the rest is not drained.
ASGI/server transport buffers and concurrent connections need separate server/edge
limits; this is not a total process-memory or slow-client protection guarantee.

`413 PUBLIC_BODY_TOO_LARGE` asks the buyer to reduce the request.
`429 PUBLIC_RATE_LIMITED` includes an integer `Retry-After` (seconds, exposed via
CORS) and the delay in its readable message. Rejection is before domain mutation;
retry after the delay, retaining an existing key when recovering an uncertain earlier
attempt. Both use the standard error envelope and private/no-store/referrer headers.
The buyer form preserves input and displays the rejection without claiming success.

Limiter state is two numbers: it retains no tokens, IP addresses or request bodies.
Invalid tokens, spoofed forwarded headers and changing URLs cannot bypass the shared
quota. One noisy caller can exhaust capacity for other buyers; boundaries permit a
burst either side of window reset. Workers/restarts have independent quotas. This is
local self-test admission control, not distributed hosted abuse protection.


## Address entry without AI

Address AI is retired by [ADR-0007](../adr/0007-review-assistant-data-and-authority-boundary.md).
No public route parses, suggests or extracts delivery addresses, and configured
Gemini credentials cannot restore that behavior. `POST
/api/public/orders/{token}/address-extraction` no longer exists (404). Buyers enter
the written address themselves and may also submit the structured
`district`/`thana`/`area`/`street_line`/`landmark` fields. Those confirmed fields
belong to the buyer revision and remain readable by the owning seller.

Migration `0027_retire_address_ai.sql` erases historical extraction raw requests,
provider responses, generated suggestions and extraction replay results by dropping
`address_extractions`, and removes the obsolete `ai_assistance_available` key from
cached submission responses. Buyer revisions, payment claims, receipts, allocations,
lifecycle and duplicate-payment protection are preserved. This slice does not make
Pathao selections mandatory.

## Seller buyer corrections

- Seller-authenticated link resolution and same-shop order authorization are required;
  a buyer token never authorizes corrections or private history.
- `PATCH /api/seller/orders/{id}/buyer-details` requires `Idempotency-Key`,
  `expected_version`, `reason`, and one or more typed buyer fields. Pending payment
  claims can change; confirmed orders accept delivery fields only. Commercial terms
  are rejected as unknown fields. Stale versions return 409.
- Immutable buyer revisions record actor, reason, creation time and a separate
  `claim_accepted_at`. Delivery-only edits retain the claim bound; payment-claim
  changes use the server acceptance time. First submission time is preserved.
- `GET /api/seller/orders/{id}/history` pages revisions by cursor and limit (max 100).
  All correction/history responses, including failures, are private/no-store.
- Corrections take the shared shop lock, append a revision, invalidate affected
  receipt versions, recheck both old and new payment identities, and commit the
  idempotent result atomically. Pending review reasons describe the latest check.
- Migration `0008_claim_acceptance_time.sql` backfills existing revisions from their
  creation time. No shared or hosted migration is implied by local verification.

## Buyer-link revocation

- `POST /api/seller/orders/{id}/revoke-link` requires owning-seller authentication,
  `Idempotency-Key` and strict positive `expected_version`; unknown fields fail validation.
  Returns `SellerOrder` with `buyer_link_revoked_at`. Same-key/payload retries replay
  the committed result; changed payload or stale version returns 409. Foreign orders
  return 404. Database failures return 503 and require identical-payload/key retry.
- Revocation, version increment, audit event and replay record commit together under
  the shop-then-order lock. It preserves lifecycle, terms, deadline and allocation.
  Public reads and submission replay return 410
  `BUYER_LINK_REVOKED` before cached results or provider work. Public
  authorization refreshes locked database rows to avoid stale session state.
- Migration `0018_buyer_link_revocation.sql` is additive. Apply it before running
  this version against a persistent database. Local disposable-schema verification
  does not apply this migration to Neon or any manual self-test dataset.

## Address assistance language metadata

Retired with address AI. No public route accepts an address extraction language
hint or returns `explanation_language`; historical responses are not served.
