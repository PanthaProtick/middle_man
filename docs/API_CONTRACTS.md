# API Contracts & Data Flow Guide

## Optional screenshot extraction

`POST /api/public/orders/{token}/payment-extraction` requires `Idempotency-Key`
and `{evidence_id, ai_opt_in: true}` (literal JSON boolean). The public-access gate
and unsubmitted/unexpired checks apply to new requests and replay. Only a retained,
staged screenshot owned by that order/shop is eligible; rejection happens before
private storage reads or Gemini calls.

Responses include `available`, `evidence_id`, nullable typed `suggestions`,
`review_required: true`, and `message`. Suggestions contain nullable
`is_payment_screenshot`, `provider` (`bkash`/`nagad`), `trx_id`, `amount_minor`,
`sender_number`, `receiver_number`, `occurred_at` (timezone-qualified ISO time),
and an explicit `unreadable_fields` list. Unexpected fields/types fail closed to
manual entry. Suggestions cannot create seller receipts, submit or confirm orders.
The buyer explicitly applies reviewed fields to the ordinary form; receiver/time
remain review context and cannot change the designated seller account. Manual
form validation still applies. Edits to payment fields, evidence replacement,
submission, and navigation invalidate late output.

The tool-free backend Gemini adapter has a five-second HTTP timeout, a six-second
total provider deadline, bounded response bytes, no automatic retries, and no SMS
entry point. Five distinct attempts per order are allowed. PostgreSQL commits a
`pending` budget reservation before external work, then rechecks order/evidence
eligibility and holds the order/evidence locks during the bounded call. This
trades up to six seconds of contention for serialization with submission.
Committed results (including expected failures) replay without another call.
An unfinished reservation returns 409 `EXTRACTION_OUTCOME_UNKNOWN`; retrying that
key never calls Gemini again. Other keys still consume the five-attempt budget.
A database failure returns 503 with same-key recovery guidance. This bounds
lost-response retries and does not promise exactly-once provider billing.

Migration `0014_payment_extractions.sql` stores consent through the explicit
request contract plus mutation fingerprint, protected order/shop/evidence ownership,
structured replay outcomes, and optional raw model output. Collection/deletion
times inherit the screenshot's original deadline; processing never restarts it.
`purge_payment_raw_evidence` clears due raw output inside the caller's transaction.
Ticket 16 owns scheduling/overdue reporting and completed-order cleanup; backup
and provider-side deletion remain launch gates. Structured suggestions remain
personal data under the completed-order policy, never permanent audit/log content.
Actual Gemini image/model behavior and service data terms require separate live
acceptance; unit tests and the browser harness use explicit offline adapters.

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

> [!NOTE]
> This document is part of **Tier 2 (On-Demand Context)**. Agents should consult this file when adding new FastAPI endpoints or updating frontend client calls.

---

## 1. REST Endpoint Conventions

* **Base URL:** `/api`
* **Response Status Codes:**
  * `200 OK`: Successful retrieval or synchronous operation.
  * `200 OK`: Current demo item creation also returns 200.
  * `422 Unprocessable Entity`: FastAPI request validation failure or malformed payload.
  * `404 Not Found`: Target entity does not exist.
  * `500 Internal Server Error`: Unhandled exception (logs must contain trace).

---

## 2. Pydantic v2 Models & Serialization

All request bodies and responses are defined in `backend/app/models/schemas.py`:

* Explicit type annotations for all fields (no raw `dict` or untyped lists).
* Example contract:
  ```python
  from pydantic import BaseModel

  class ItemCreate(BaseModel):
      title: str
      description: str | None = None
      tags: list[str] = []

  class ItemResponse(BaseModel):
      id: str
      title: str
      description: str | None = None
      tags: list[str] = []
      created_at: str
  ```

---

## 3. Frontend-Backend Synchronization

* Frontend types matching backend schemas are kept in `frontend/src/services/api.ts` or co-located inside `frontend/src/features/<feature>/<feature>.types.ts`.
* Avoid `any` at all costs. Verify frontend type-safety with:
  ```bash
  npm run typecheck:frontend
  ```

## 4. Current demo boundaries

Item routes use an in-memory list even when a database URL is configured. Records
are lost when the process restarts. Configuration flags report configuration,
not successful provider calls, database persistence, or authorization enforcement.
Frontend fallback items are also local simulations, not confirmed server writes.
Tests of these demo behaviors must not be reported as live-service acceptance.


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


## Seller payment exception acceptance

- GET `/api/seller/orders/{id}/payment-preview?transaction_id=...` compares the active
  claim with an existing same-shop receipt and returns exception codes, hard blockers,
  actual COD and both order/receipt versions. Excessive payments have null COD.
- POST `/api/seller/orders/{id}/decisions` currently supports `action: confirm` only.
  Require `expected_version`, `expected_transaction_version`, `transaction_id`,
  strict positive `accepted_amount_minor`, nonblank `reason`, and `Idempotency-Key`.
  The accepted amount must equal the full recorded receipt and cannot exceed total.
  This slice does not implement rejection, cancellation, refunds or reassignment.
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


## Raw evidence retention and cleanup (Ticket 18)

- Raw payment screenshots, raw SMS bodies, and raw AI extraction requests/responses
  expire 30 days from original collection. Reprocessing/reimport never restarts deadlines.
- `purge_raw_evidence` deletes raw image files and sets raw columns (`raw_text`,
  `raw_request`, `raw_response`) to NULL. Structured observations, claims, order status,
  accepted allocation, COD, and used-payment markers remain intact.
- Deleted evidence reads via `GET /api/seller/evidence/{id}` return 410 `EVIDENCE_UNAVAILABLE`.
  Overdue unpurged evidence returns 410 `EVIDENCE_EXPIRED`.
- `GET /api/seller/retention/status` provides owning-seller visibility into retained vs
  purged counts, overdue items, and failure history without cross-shop or raw content leaks.
- `POST /api/seller/retention/cleanup` runs safe, retryable cleanup. Storage outages prevent
  acknowledgement or marking records deleted until required copies are removed.
- External storage bucket version history, database backup retention lifecycles, and
  third-party AI provider logging terms remain explicit launch gates, not false deletion claims.

## Completed structured record retention (Ticket 19)

- GET `/api/seller/retention/structured` returns typed `checked_at`, `overdue`,
  `failed`, `removed` and `standby`. POST `/api/seller/retention/structured/cleanup`
  retries the owning shop's due records using server time. Neither accepts a shop
  identifier or deletion clock from the caller. The integrated seller panel reloads
  orders and receipts after cleanup. Database outages return unavailable, never a
  successful deletion response. `standby` identifies the explicit offline adapter.
- `purge_completed_orders(db, now, shop_id)` is the maintenance seam: invoke it
  repeatedly from an operator/scheduler with its own database session. Due work is
  discovered from durable completion timestamps; per-order attempts and safe failure
  codes survive restart. A failed order is rolled back independently and retried.
  Hosting/scheduling this maintenance is a deployment gate; no hosted scheduler has
  been installed. Run the raw-evidence worker separately at its 30-day deadline.
- The deletion date is the first completion plus 12 calendar months, clamping leap
  day to February's last day. Cancellation and later corrections preserve the first
  completion. Unopened awaiting-buyer records use their original expiry as completion.
- Remove buyer revisions, structured AI suggestions, matching review reasons,
  order audits, token-open measurements and personal replay-cache results. Shared
  receipt observations/audits remain while any unresolved or not-yet-due order
  needs their historic identities. Standalone unmatched receipts have no new period.
  Raw SMS, images and raw AI copies retain their separate original 30-day deadlines.
- Order tombstones preserve shop/ID, token lookup digest, lifecycle, completion and
  replacement links. Remove recoverable portal tokens and commercial snapshot text.
  Owning seller detail/history/summary and buyer reads return 410 `RECORD_UNAVAILABLE`;
  order lists and CSV exports omit tombstones. Historical confirmations do not become
  expired. Replay caches return unavailable rather than replaying personal responses.
- Consumed receipts retain a nonspendable allocation/receipt skeleton to preserve
  relational uniqueness, with readable TrxID/sender, amounts and decision text removed.
  Independent shop/provider keyed identity markers survive. The existing HMAC uses
  `CLERK_SECRET_KEY`; migration 0017 binds a per-shop key fingerprint. A changed or
  missing key blocks receipt ingestion, reconciliation, manual acceptance and
  structured cleanup. Legacy bindings require all existing markers to verify against
  retained identities first. Restore the original key to recover; key rotation requires
  a separately reviewed migration, never silently rebinding after details are removed.
- Account deletion, standalone unmatched structured-receipt retention, storage version
  history, backup purge and provider/log copies remain unsettled launch gates. These
  endpoints and local checks do not establish real-data readiness or deploy anything.
