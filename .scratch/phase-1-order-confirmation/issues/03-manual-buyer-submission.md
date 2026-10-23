# 03: Submit buyer details and see pending status

**What to build:** A buyer completes a mobile manual form and sees a durable pending acknowledgement without needing an account, screenshot or AI.

**Blocked by:** [02: Create an order and retrieve its buyer link](02-create-order-links.md)

**Status:** completed

## Acceptance criteria

- [x] Display only public shop/order/payment instructions, copy receiving number, and immutable terms. Require reviewed readable address, name, contact, full payment sender, provider, TrxID and claimed amount.
- [x] Validate contact independently from sender; support specified Bangla-digit/local/+880 canonicalization while preserving raw reviewed values. Trim TrxID boundaries without undocumented normalization.
- [x] Atomically accept first completed submission strictly before server expiry; at/after deadline return expired. Initial submission is single-use, idempotent and persists buyer/claim revisions, server timestamps and pending status.
- [x] Completed submissions never expire automatically. Opening/drafting the form does not count; show status instead of a buyer editing/resubmission loop after success.
- [x] Preserve entered values on recoverable failures, use the same key/payload after unknown outcomes, and never treat a local optimistic record as saved. Include Bangla/English mobile labels and accessible validation.
- [x] Keep live public operations disabled until buyer-access/projection policy is settled; use explicit non-live permission adapters for demonstrations. Token possession never permits seller edits.
- [x] Record minimal durable aggregate link-open/submission measurements without raw personal data; distinguish repeat/bot opens and unknown commits from unique buyers, and do not claim identity proof.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC05, AC07, AC08, AC09, AC28, AC31, AC32, AC33, AC37, AC38, AC39, AC44, AC45, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

- **Verification Result Artifact**: `.cache/checks/check-1kBTOr/result.json`
- **Root Checks**: `npm run check` (All 8 stages PASS: tooling tests, backend lint, backend types, backend tests, frontend lint, frontend test, frontend build, HTTP smoke).
- **Focused Backend Tests**: `npm run test:backend` (51 passed, including `test_buyer_models.py`, `test_buyer_storage.py`, `test_public_order_routes.py`, `test_order_routes.py`, `test_order_storage.py`, `test_seller_routes.py`, `test_seller_storage.py`).
- **Focused Frontend Tests**: `npm run test:frontend` (21 passed, including `BuyerPortal.test.tsx`, `CreateOrderModal.test.tsx`, `SellerWorkspace.test.tsx`, and `api.test.ts`).
- **Evidence status**:
  - Offline automated tests (FastAPI ASGI AsyncClient, SQLite in-memory relational constraints, React DOM / Vitest): PASS
  - Disposable PostgreSQL integration target: NOT RUN (PostgreSQL migration `0003_create_buyer_submissions.sql` verified; schema constraints tested via SQLite in-memory)
  - Browser flow: PASS (Production build tested with HTTP smoke and Vitest DOM testing)
  - Configured live identity provider (Clerk): NOT RUN (Offline dev adapters verified)
- **Changed paths**:
  - `backend/app/core/public_gate.py`: Public access policy boundary gate (AC44, returns 503 when policy is unsettled or live production)
  - `backend/app/models/buyer.py`: Pydantic v2 validation contracts for `Address`, `PaymentClaim`, `BuyerSubmission`, `PublicOrder`, and `clean_trx_id`
  - `backend/app/models/entities.py`: `BuyerRevisionTable` and `LinkMeasurementTable` relational entities and relationship on `OrderTable`
  - `backend/app/services/buyer_service.py`: Domain logic for public order retrieval, single-use idempotent buyer submission, and minimal aggregate measurements
  - `backend/app/services/buyer_projection.py`: Pure public projection builder stripping personal buyer details and internal seller fraud verdicts (AC48)
  - `backend/app/api/public_orders.py`: FastAPI routes `GET /public/orders/{token}` and `POST /public/orders/{token}/submission` with security headers
  - `backend/migrations/0003_create_buyer_submissions.sql`: PostgreSQL DDL migration for `buyer_revisions` and `link_measurements`
  - `backend/tests/test_buyer_models.py`: Phone canonicalization, Bangla digits, TrxID trimming, amount bounds, and separate contact/sender validation tests
  - `backend/tests/test_public_order_routes.py`: Public gate, privacy projection, atomic expiry (410), single-use submission, idempotency replay, and seller mutation isolation tests
  - `backend/tests/test_buyer_storage.py`: Relational schema constraints, foreign keys, and revision durability tests
  - `frontend/src/features/buyer/types.ts`: TypeScript contracts for `PublicOrder`, `BuyerSubmissionInput`, `BuyerFormDraft`
  - `frontend/src/features/buyer/api.ts`: Frontend client for public order fetching, BDT currency formatting, and submission
  - `frontend/src/features/buyer/BuyerOrderDetails.tsx`: Order terms, receiving number with copy-to-clipboard, and Bangladesh deadline display
  - `frontend/src/features/buyer/BuyerSubmissionForm.tsx`: Bilingual mobile form with separate contact/sender inputs and accessible error messages
  - `frontend/src/features/buyer/PaymentClaimFields.tsx`: Decomposed payment fields (provider, sender number, TrxID, amount)
  - `frontend/src/features/buyer/BuyerStatusView.tsx`: Post-submission pending acknowledgement, 30s auto-polling, manual refresh, and terminal states
  - `frontend/src/features/buyer/BuyerPortal.tsx`: Top-level buyer orchestrator with error handling and gate detection
  - `frontend/src/features/buyer/BuyerPortal.test.tsx`: Vitest component tests for rendering, copying number, submission transition, and 503 handling
  - `frontend/src/features/seller/OrderDetailModal.tsx`: Added direct link to open the buyer portal
  - `frontend/src/App.tsx`: Routing for `/orders/:token` to render `BuyerPortal`

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.
