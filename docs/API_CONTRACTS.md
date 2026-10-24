# API Contracts & Data Flow Guide

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
