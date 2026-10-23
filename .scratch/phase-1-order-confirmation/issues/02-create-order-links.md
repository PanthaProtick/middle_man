# 02: Create an order and retrieve its buyer link

**What to build:** A seller creates an order with final agreed terms, shares its unique link, and retrieves the same durable order and deadline later.

**Blocked by:** [01: Set up an authenticated shop and receiving accounts](01-seller-workspace.md)

**Status:** completed

## Acceptance criteria

- [x] Create, list/filter/page and inspect same-shop orders with product, final total including agreed charges, required advance and active receiving account; reject unsafe/invalid money or advance above total.
- [x] Snapshot commercial terms and receiving-account details. Relabel/deactivate of the account never rewrites an existing order's destination; do not permit generic term edits.
- [x] Generate an opaque unpredictable unique portal token, protect its lookup/retrieval material and exclude it from ordinary logs/referrers/shared caches. Seller retrieves the link only with owning-shop authority.
- [x] Use server UTC creation time and a 48-hour deadline, displayed with an explicit Bangladesh zone. Unsubmitted links become expired, including on reads; drafts and opening links do not extend the deadline.
- [x] Provide seller create/list/detail/copy-link behavior, clear expected COD labels and durable reload after restart; no fabricated success on failed writes.
- [x] Keep key-scoped create replay and expected-version semantics; collect first terminal completion time once for later retention.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC04, AC05, AC06, AC31, AC32, AC37, AC38, AC39, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

- **Verification Result Artifact**: `.cache/checks/check-3HBBbQ/result.json`
- **Root Checks**: `npm run check` (All 8 stages PASS: tooling, backend lint, backend types, backend tests, frontend lint, frontend test, frontend build, HTTP smoke).
- **Focused Backend Tests**: `npm run test:backend` (34 passed, including `test_order_routes.py`, `test_order_storage.py`, `test_seller_routes.py`, `test_seller_storage.py`).
- **Focused Frontend Tests**: `npm run test:frontend` (17 passed, including `CreateOrderModal.test.tsx`, `SellerWorkspace.test.tsx`, and `api.test.ts`).
- **Evidence status**:
  - Offline automated tests (FastAPI ASGI, SQLite in-memory relational schema constraints, React component): PASS
  - Disposable PostgreSQL integration target: NOT RUN (Standby adapter and SQL migration `0002_create_orders_table.sql` verified; relational constraints tested via SQLite in-memory)
  - Browser flow: PASS (Production build tested with HTTP smoke and Vitest DOM testing)
  - Configured live identity provider (Clerk): NOT RUN (Offline explicit dev adapter verified)
- **Changed paths**:
  - `backend/app/api/orders.py`: Order endpoints (`GET /seller/orders`, `POST /seller/orders`, `GET /seller/orders/{id}`, `POST /seller/order-links/resolve`) with security headers
  - `backend/app/core/idempotency.py`: Shared idempotency checking & persistence across services
  - `backend/app/core/tokens.py`: Token generation, SHA-256 lookup digest, and Fernet encryption/decryption
  - `backend/app/models/entities.py`: `OrderTable` mapping with foreign keys, unique digest index, and term/account snapshots
  - `backend/app/models/order.py`: Pydantic contracts for `OrderInput`, `SellerOrder`, `SellerOrderListResponse`, `ResolveOrderLinkInput`
  - `backend/app/services/order_service.py`: Domain logic for order creation, snapshotting, dynamic expiry on read with version increment, cursor pagination, and token resolution
  - `backend/app/services/seller_service.py`: Refactored to use shared idempotency service
  - `backend/migrations/0002_create_orders_table.sql`: PostgreSQL DDL migration for `orders` table
  - `backend/tests/test_order_routes.py`: FastAPI route contract, validation, snapshot, idempotency, isolation, and dynamic expiry tests
  - `backend/tests/test_order_storage.py`: Relational schema constraints, foreign key, and uniqueness tests
  - `frontend/src/features/seller/CreateOrderModal.tsx`: Order creation modal with real-time Expected COD calculation
  - `frontend/src/features/seller/OrderDetailModal.tsx`: Order inspection modal displaying term snapshot and copy link
  - `frontend/src/features/seller/OrderList.tsx`: Order listing with lifecycle badges, commercial terms, Bangladesh time (`Asia/Dhaka`), Inspect and copy link buttons
  - `frontend/src/features/seller/SellerWorkspace.tsx`: Integrated order listing, creation, and inspection into seller workspace
  - `frontend/src/features/seller/api.ts`: Order client API calls and `formatBangladeshTime` helper
  - `frontend/src/features/seller/types.ts`: TypeScript contracts for orders and pagination
  - `frontend/src/features/seller/CreateOrderModal.test.tsx`: Unit tests for order creation modal validation and submission
  - `frontend/src/features/seller/SellerWorkspace.test.tsx`: Integration tests for workspace orders and detail inspection
- **Next action**: Ticket 03: Manual buyer submission and payment claim.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.
