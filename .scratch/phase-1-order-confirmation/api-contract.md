# Phase 1 API and UI contract

Normative annex to [spec.md](spec.md). Operation paths are target interfaces beneath
`/api`; they do not describe existing product endpoints. JSON contracts use explicit
Pydantic v2 and matching strict TypeScript types, with no untyped payload escape hatch.

## Identity and access

- Seller operations require verified server-side identity and owning-shop membership.
  Derive shop scope from identity; never accept a client-supplied shop as authority.
- Missing/invalid seller authentication returns 401; another shop's object returns
  404 without existence details. An unavailable verifier returns 503, not anonymous access.
- Test/demo identities use an injected adapter in explicit non-live mode. They must
  not be enabled through a request header or silently accepted by a pilot deployment.
- Public buyer authorization is an intentionally deferred product policy. Implement
  a gate at the public-order boundary, disabled for live use until that policy is
  settled. Tests can inject explicit permission in a labelled controlled environment.
  Do not silently interpret a token as final authorization or add an OTP requirement.
- Use opaque order tokens to identify buyer portals. Seller editing through the same
  page resolves to authenticated seller APIs; token possession never enables editing.
- Initial form response contains public shop/order/payment instructions, not existing
  buyer data. Submitted status projection excludes full contact/address/sender, raw
  evidence and internal fraud/review details. Final public-access/projection approval
  remains a launch gate. Private evidence reads are owning-seller only.
- Private responses and token pages are not shared-cacheable. Avoid logging tokens,
  evidence URLs or personal fields; prevent token leakage through referrers.

## Common wire conventions

| Value | Contract |
| --- | --- |
| IDs | Opaque strings; separate internal order ID and public portal token |
| Money | Positive integer minor-unit values; never a floating-point amount |
| Time | ISO-8601 timezone-qualified instants; nullable when genuinely unknown |
| Provider | `bkash` or `nagad`; unknown extraction output remains a suggestion, not valid receipt evidence |
| Version | Positive integer aggregate version; required as `expected_version` on seller mutations |
| Reason | Nonblank seller explanation on correction, exception, conflict resolution, rejection or cancellation |
| Pagination | Opaque cursor, default 25 and maximum 100 records; deterministic ordering |
| Mutation key | `Idempotency-Key`, random client key retained across retries of the same operation/payload |
| Errors | `{error: {code, message, fields?}, request_id}`; `fields` is a typed list of field/code/message objects |

Use 201 for new orders/accounts/uploads, 200 for committed reads/edits/decisions,
and the original status on an idempotent replay. Use 401 authentication, 404 missing
or inaccessible objects, 409 state/version/idempotency conflicts, 410 expired initial
submission, 413 size limits, 415 unsupported media, 422 invalid fields, 429 rate limits
with retry guidance, and 503 unavailable required dependencies or disabled live policy.
An accepted payment claim remains a successful pending submission even if matching
fails; represent that in the order result, not as a transport validation error.

## Typed shapes

| Shape | Required fields and optional information |
| --- | --- |
| ShopInput | `display_name`; authenticated owner is server-derived |
| AccountInput | `provider`, `receiving_number`, `label` |
| OrderInput | `product_name`, `total_minor`, `required_advance_minor`, `payment_account_id` |
| Address | `raw_text`; optional reviewed `district`, `thana`, `area`, `street_line`, `landmark`; never require courier codes |
| PaymentClaim | `provider`, `trx_id`, `sender_number`, `amount_minor`; optional claimed time and evidence ID |
| BuyerSubmission | `buyer_name`, `contact_number`, `address`, `payment_claim`; screenshot not required |
| ManualReceipt | `payment_account_id`, `provider`, `trx_id`, `amount_minor`; nullable sender/time, source fixed server-side as manual |
| SellerOrder | IDs, owning-seller portal URL, immutable terms/account snapshot, lifecycle, review reasons, buyer/claim revision, expected/actual COD distinction, allocation basis, timestamps, version |
| PublicOrder | Public order/shop terms, lifecycle/status message, expected or accepted COD as labelled, submission acknowledgement; no full personal data or internal evidence |
| ReceiptView | Identity/account, structured observations, source/parse/conflict state, used/unmatched state, related same-shop claims, version; raw evidence only while retained |
| DecisionInput | `action`, `expected_version`, `reason`; manual confirmation additionally requires `transaction_id` and previewed `accepted_amount_minor` |
| ImportResult | Import ID, typed item results with parse state, receipt ID when known, explicit missing/conflicting fields and resulting order IDs; no cross-shop information |
| ExtractionResult | `available`, typed nullable suggestions, unreadable/clarification fields, evidence ID when relevant; never an order confirmation |

Address suggestions contain nullable `district`, `thana`, `area`, `street_line` and
`landmark`, plus `needs_clarification` and a nullable `clarification_question`.
Payment suggestions contain nullable `is_payment_screenshot`, `provider`, `trx_id`,
`amount_minor`, `sender_number`, `receiver_number` and `occurred_at`, plus an explicit
`unreadable_fields` list. Any model confidence is labelled an uncalibrated suggestion,
never an acceptance threshold. Unknowns remain null; frontend and backend share these
field names and validate them before populating a claim.

Reject unknown write fields rather than accepting client status, allocation or COD
overrides. Bound strings and collection counts consistently at API/UI/storage layers.
Initial technical limits: names/product/labels 200 characters, address 2000, TrxID 128,
decision reason 1000, SMS batch 50 messages and 64 KiB. These are tunable technical
defaults, not interview-derived business claims. Reject oversize input before AI work.

## Seller operations

| Operation | Input | Observable result |
| --- | --- | --- |
| GET `/seller/shop` | Verified identity | Owning shop or setup-needed result |
| POST `/seller/shop` | ShopInput, mutation key | One durable pilot shop for identity; duplicate creation cannot create another |
| GET/POST `/seller/payment-accounts` | AccountInput on create | Same-shop accounts or newly created active account |
| PATCH `/seller/payment-accounts/{id}` | Version; label/active only | Updated metadata; referenced provider/number cannot change |
| GET `/seller/orders` | Cursor/status/review filters | Paginated same-shop summaries and next cursor |
| POST `/seller/orders` | OrderInput, mutation key | Durable awaiting-buyer order, server expiry and new portal link |
| GET `/seller/orders/{id}` | Same-shop ID | SellerOrder and relevant history/receipt state |
| POST `/seller/order-links/resolve` | Portal token in body | Owning seller's order ID; no edit permission from token alone |
| PATCH `/seller/orders/{id}/buyer-details` | Expected version, reason, typed buyer/claim changes | New revision and recheck; confirmed payment/term edits fail |
| POST `/seller/orders/{id}/decisions` | DecisionInput, mutation key | Atomic manual confirmation, rejection or cancellation; updated SellerOrder |
| POST `/seller/orders/{id}/replacement` | Version, reason, new OrderInput, mutation key | Cancel unallocated predecessor and create linked new order; no silent claim transfer |
| GET `/seller/orders/{id}/history` | Cursor | Same-shop correction/decision history under retention policy |
| GET `/seller/orders/export` | Filters | CSV of same-shop summaries and actual/expected balance distinction |
| POST `/seller/transactions/sms-import` | Selected account, raw text, mutation key | ImportResult; mixed parse failures are explicit, successful items remain durable |
| POST `/seller/transactions` | ManualReceipt, mutation key | Structured receipt and rechecked eligible orders; missing sender/time needs review |
| GET `/seller/transactions` | Cursor/parse/review/used filters | Same-shop receipt/import inbox |
| PATCH `/seller/transactions/{id}` | Version, reason, corrected fields | New observation for unallocated receipt; collision/used-state errors are explicit |
| POST `/seller/transactions/{id}/resolve` | Version, reason, selected observation or corrected receipt, mutation key | Audited resolution of conflicting evidence; recheck only when consistent |
| GET `/seller/evidence/{id}` | Same-shop authority | Short-lived private retrieval while retained; unavailable after deletion |

Register literal export routes without letting a generic order-ID route swallow them.
Account deactivation prevents selection for new orders but does not rewrite existing
snapshots or invalidate legitimate pending claims. Allocated replacement returns 409
`PAYMENT_RESOLUTION_REQUIRED`; Phase 1 cannot transfer or refund that payment.
Manual decisions report violations such as `TRANSACTION_ALREADY_USED`,
`RECEIPT_REQUIRED`, `AMOUNT_EXCEEDS_TOTAL`, `STALE_VERSION` and
`PAYMENT_FIELDS_LOCKED`; no partial status or balance write is allowed.

For pending corrections, the seller may edit payment claims. For confirmed orders,
only name/contact/address are writable. Receipt history/conflict resolution never
edits the already accepted allocation; a later contradiction stays an alert.

## Buyer and optional AI operations

All operations below are subject to the deferred public-access gate.

| Operation | Input | Observable result |
| --- | --- | --- |
| GET `/public/orders/{token}` | Portal identity and approved access | PublicOrder; form before submission or status afterward |
| POST `/public/orders/{token}/submission` | BuyerSubmission, mutation key | Durable pending/confirmed projection; repeat different submission fails 409 |
| POST `/public/orders/{token}/evidence` | JPEG/PNG upload, mutation key | Private staged evidence ID bound to this order, not public object path |
| POST `/public/orders/{token}/address-extraction` | Address text, explicit AI choice, mutation key | Nullable structured suggestions for buyer review |
| POST `/public/orders/{token}/payment-extraction` | Bound evidence ID, explicit AI choice, mutation key | Nullable payment suggestions, never receipt evidence |

Initial upload defaults: at most 5 MiB and 20 megapixels, JPEG/PNG only. Check decoded
content and dimensions rather than trusting filename/MIME, reject malformed input,
strip metadata, use private storage and clean up failed/orphan staged uploads by their
retention deadline. Evidence references from another order/shop are invalid.
Store upload/extraction results before acknowledging; a retried extraction reuses its
committed result rather than triggering duplicate paid calls unnecessarily.
Buyer upload/extraction operations require an unsubmitted, unexpired order. They do
not extend expiry or create a submission. Reject them after submission or expiry.

Gemini is backend-only, invoked only after explicit choice; no SMS ingestion path
calls it. Keep keys out of the browser. Do not let image/text content change system
instructions, invoke tools, choose identities, accept funds or bypass schema validation.
Apply bounded timeout/retries and an explicit unavailable/manual-entry response.
Malformed output, low confidence or unknown provider never confirms an order.
Extraction fields do not overwrite reviewed input automatically on late responses.
Do not promise exactly-once billing for a lost external response; bound retries and
offer manual entry. Raw provider responses follow evidence retention, not permanent logs.

## Retry, conflict and failure semantics

- Scope mutation keys to authorized actor/portal, operation and aggregate. Same key
  and payload returns the committed result; changed payload with that key returns
  409 `IDEMPOTENCY_KEY_REUSED`. Keep outcomes at least 48 hours; aggregate uniqueness
  and state rules continue preventing duplicate submissions/allocations afterward.
- A 5xx, lost connection or client timeout may follow a commit. Retain the same key
  and payload, retry/refetch and reconcile. Never generate a new order optimistically.
- A stale version returns 409 with safe refetch guidance; no last-write-wins edits.
- A claimed receipt not found remains pending. Known mismatches carry seller-visible
  typed reasons such as `SENDER_MISMATCH`, `AMOUNT_MISMATCH`, `TIME_UNCLEAR`,
  `WRONG_RECEIVING_ACCOUNT`, `CONFLICTING_RECEIPTS`, `COMPETING_CLAIMS`, `PAYMENT_USED`.
- Required storage, authorization or database outages return explicit errors with
  request IDs. Do not expose provider exceptions, secrets or another shop's records.
- Rate-limit portal lookup/submission/upload/AI and authenticated import/export;
  actual thresholds and distributed enforcement must be recorded before live traffic.

## Frontend behavior and integration

- Seller setup, order creation/list/detail, transaction inbox/review, manual decisions
  and copy/export consume the same typed contracts; no frontend-only status machine.
- Buyer page shows immutable terms, copy number, separate contact/sender fields,
  address, optional evidence/AI choice and a single completed-submission action.
- Preserve entered form data on recoverable errors; disable duplicate clicks but
  rely on server idempotency for correctness. Display validation beside fields.
- Show loading, empty, offline, unavailable, pending/review, confirmed, expired,
  rejected and cancelled states explicitly. No mock success for failed product writes.
- After submission show status instead of editable buyer form. Seller authentication
  reveals authorized correction controls; buyer-facing tokens do not grant those rights.
- Poll pending status every 30 seconds while visible, with manual refresh and bounded
  backoff. Stop on terminal outcome/unavailable retained record, hidden/unmounted page
  or cancellation; ignore stale responses so they cannot regress displayed state.
- Confirmation displays accepted amount and actual remaining COD. Seller review
  previews amount exceptions before approval and shows internal reasons/history.
- Support Bangla/English labels and readable mobile layouts, keyboard/accessibility
  basics and slow-connection states. Do not present courier controls in Phase 1.
- CSV export is same-shop, access-controlled and spreadsheet-formula-safe for buyer
  input. Copy/export must not be described as creating or updating a courier booking.
