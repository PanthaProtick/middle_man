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


## Optional address assistance

`POST /api/public/orders/{token}/address-extraction` requires `Idempotency-Key`
and `{raw_text, ai_opt_in: true}`. Consent must be a JSON boolean. The existing
public gate applies; orders must still be unsubmitted and unexpired, including on
replay. A changed payload with the same key returns 409. At most five distinct
requests per order are accepted; the manual submission remains available.

The response has `available` (boolean), `suggestions`,
`review_required: true`, and `message`. Suggestions contain required nullable
`district`, `thana`, `area`, `street_line`, `landmark`, and `clarification_question`
strings, plus a required boolean `needs_clarification`.
Invalid, blocked, oversized, incomplete or unavailable provider output returns a
manual fallback. Suggestions never submit orders or confirm payments. The buyer
edits the separate review fields and explicitly applies them to the readable
address; nulls remain empty. Address edits, submission and navigation invalidate
late responses. A transport retry retains the same address/key.

Gemini is backend-only, with no tools, no automatic retries, a five-second HTTP
timeout and a six-second total provider deadline. The adapter uses the official
[generateContent contract](https://ai.google.dev/api/generate-content). Tests use
an explicit offline provider/HTTP transport. Current model suitability, service
data terms and actual configured-provider behavior remain launch gates.

`address_extractions` owns raw requests/responses by shop and order, with immutable
collection time and original 30-day deadlines. Raw text is excluded from generic
idempotency records, audit logs and public status projections. Cleanup must clear
both raw columns by `delete_after`; ticket 16 owns scheduled cleanup and overdue
reporting, alongside the shared backup/provider purge launch gates. Structured
results are retained separately for replay and remain personal data under the
shared completed-order retention policy. Replays never extend raw deadlines.

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
  Public reads, submission/upload replay and AI assistance return 410
  `BUYER_LINK_REVOKED` before cached results, storage reads or provider work. Public
  authorization refreshes locked database rows to avoid stale session state.
- Migration `0018_buyer_link_revocation.sql` is additive. Apply it before running
  this version against a persistent database. Local disposable-schema verification
  does not apply this migration to Neon or any manual self-test dataset.

## Address assistance language metadata

`POST /api/public/orders/{token}/address-extraction` accepts optional `language`
(`en` or `bn`, default `en`) to guide a fresh provider clarification. The
response includes nullable `explanation_language`; historical responses without
metadata remain valid and have an unknown language. This hint is excluded from
the existing idempotency fingerprint: a retry in another language replays the
original extraction and language without another provider call. Address fields
remain unchanged and require buyer review. Provider output language is requested,
not independently verified. AI opt-in, limits, retention, and lifecycle gates remain
unchanged.
