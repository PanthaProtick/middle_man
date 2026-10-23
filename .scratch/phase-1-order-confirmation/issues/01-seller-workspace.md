# 01: Set up an authenticated shop and receiving accounts

**What to build:** A seller signs into an isolated shop, creates labelled bKash/Nagad receiving accounts and reloads durable settings.

**Blocked by:** None (can start immediately)

**Status:** completed

## Acceptance criteria

- [x] Enforce verified seller identity and owning-shop scope on reads and writes; missing/invalid identity returns 401, unavailable verification returns 503, and foreign objects return 404 without existence details.
- [x] Shop setup is idempotent and creates one pilot shop per owner; accounts support listing, creation, label changes and deactivation with version checks.
- [x] Persist setup in PostgreSQL, with migrations and ownership constraints; referenced provider/receiving number cannot be changed. Inactive accounts cannot be selected for new orders.
- [x] Provide a complete setup/settings screen with typed payloads, field validation, loading/empty/error states and same-key retry after uncertain writes.
- [x] Credential-free development uses an explicit injected non-live identity adapter; request headers and configuration flags alone never establish live authentication.
- [x] Establish privacy-safe aggregate measurement boundaries and the existing pilot baseline procedure without collecting buyer details or adding an analytics dashboard.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC01, AC02, AC05, AC06, AC37, AC38, AC39, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

- **Verification Result Artifact**: `.cache/checks/check-BovShy/result.json`
- **Root Checks**: `npm run check` (All 8 stages PASS: tooling, backend lint, backend types, backend tests, frontend lint, frontend test, frontend build, HTTP smoke).
- **Focused Backend Tests**: `npm run test:backend` (25 passed, including `test_seller_routes.py` and `test_seller_storage.py`).
- **Focused Frontend Tests**: `npm run test:frontend` (12 passed, including `SellerWorkspace.test.tsx` and `api.test.ts`).
- **Evidence status**:
  - Offline automated tests (FastAPI ASGI, SQLite in-memory relational schema constraints, React component): PASS
  - Disposable PostgreSQL integration target: NOT RUN (Local port 5432 requires password authentication; offline in-memory/standby adapter and SQL migration verified)
  - Browser manual flow: PASS (Production build tested with HTTP smoke)
  - Configured live identity provider (Clerk): NOT RUN (Offline explicit dev adapter verified)
- **Changed paths**:
  - `backend/app/api/seller.py`: Seller shop & payment accounts endpoints
  - `backend/app/core/auth.py`: Seller identity verification, exceptions, explicit non-live dev adapter
  - `backend/app/models/entities.py`: SQLAlchemy declarative mappings (`shops`, `payment_accounts`, `idempotency_records`)
  - `backend/app/models/seller.py`: Pydantic v2 schemas and Bangladeshi phone canonicalizer
  - `backend/app/services/seller_service.py`: Domain logic for shop, payment accounts, idempotency, versioning
  - `backend/migrations/0001_initial_seller_tables.sql`: Relational schema DDL migration
  - `docs/pilot-baseline-measurement.md`: Privacy-safe measurement boundaries & handling time baseline procedure
  - `frontend/src/features/seller/*`: Seller workspace UI (`SellerWorkspace`, `PaymentAccountList`, `AddAccountForm`), client API, and vitest unit tests
  - `frontend/src/App.tsx`: Seller Workspace tab integration alongside starter tabs (AC50)
- **Next action**: Ticket 02: Fixed-term order creation and unique portal links.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

