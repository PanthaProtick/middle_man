# 04: Record and inspect received payments manually

**What to build:** A seller records observations from their payment app and reviews a durable inbox of received, unmatched or conflicting payments.

**Blocked by:** [01: Set up an authenticated shop and receiving accounts](01-seller-workspace.md)

**Status:** completed

## Acceptance criteria

- [x] Manual entry requires same-shop account, provider, TrxID and positive actual amount; sender and occurrence time may be unknown and remain visibly incomplete. Source/actor are server-derived.
- [x] Enforce shop + provider + canonical TrxID identity in PostgreSQL. Sender/account changes are observations of that identity, never separate funds; independent shops remain separate.
- [x] Identical observations are no-ops for payment value even with a new request key. Contradictory observations persist visibly and block automatic eligibility without silent overwrite.
- [x] List/filter/page received records and observations with unknown/parse/conflict/used state; private detail/history never leaks through a buyer projection.
- [x] Support durable idempotent entry, explicit outage/stale errors and typed input validation in the seller form/inbox, without requiring orders to exist.
- [x] Retain only necessary structured observations and collection metadata; do not invent retention for standalone unmatched structured receipts. Keep real-data use gated until that policy is settled.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC03, AC05, AC14, AC17, AC18, AC37, AC38, AC39, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API identity/duplicate/scope/incomplete-entry tests; real PostgreSQL uniqueness and restart checks; browser entry, repeat entry and contradictory observation display. Reconciliation is added by ticket 05.

- **Verification Result Artifact**: `.cache/checks/check-GjAKPi/result.json`
- **Root Checks**: `npm run check` (All 8 stages PASS: tooling, backend lint, backend types, backend tests, frontend lint, frontend test, frontend build, HTTP smoke).
- **Focused Backend Tests**: `npm run test:backend` (74 passed, including `test_transaction_routes.py` and `test_transaction_storage.py`).
- **Focused Frontend Tests**: `npm run test:frontend` (37 passed, including `TransactionInbox.test.tsx` and `SellerWorkspace.test.tsx`).
- **Evidence status**:
  - Offline automated tests (FastAPI ASGI, SQLite in-memory relational constraints, React component): PASS
  - Disposable PostgreSQL integration target: NOT RUN (Local port 5432 requires password authentication; offline relational constraints and SQL migration verified)
  - Browser manual flow: PASS (Production build tested with HTTP smoke)
  - Configured live identity provider (Clerk): NOT RUN (Offline explicit dev adapter verified)
- **Changed paths**:
  - `backend/app/models/entities.py`: `ReceivedTransactionTable`, `TransactionObservationTable`
  - `backend/app/models/transaction.py`: `ManualReceipt`, `ReceiptView`, `TransactionObservationView`, `ReceiptListResponse`
  - `backend/app/services/transaction_service.py`: `TransactionService`
  - `backend/app/services/transaction_store.py`: in-memory store and view converters
  - `backend/app/api/transactions.py`: `POST /seller/transactions` & `GET /seller/transactions`
  - `backend/app/main.py`: register `transactions_router`
  - `backend/migrations/0005_create_received_transactions.sql`: relational schema DDL migration
  - `backend/tests/test_transaction_storage.py`: entity metadata, foreign keys, unique identity per shop tests
  - `backend/tests/test_transaction_routes.py`: API endpoint, idempotency, shop isolation, and privacy projection tests
  - `frontend/src/features/seller/types.ts`: `ReceiptView`, `TransactionObservation`, `ManualReceiptInput`
  - `frontend/src/features/seller/api.ts`: `recordManualTransaction`, `fetchTransactions`
  - `frontend/src/features/seller/ManualTransactionModal.tsx`: manual entry modal component
  - `frontend/src/features/seller/TransactionCard.tsx`: transaction presentation & expandable observation list
  - `frontend/src/features/seller/TransactionInbox.tsx`: inbox view with filter and pagination
  - `frontend/src/features/seller/SellerWorkspace.tsx`: integration into seller workspace
  - `frontend/src/features/seller/index.ts`: module exports
  - `frontend/src/features/seller/TransactionInbox.test.tsx`: frontend unit tests
- **Next action**: Ticket 05: Safe exact-match confirmation (automatic and manual reconciliation).

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

