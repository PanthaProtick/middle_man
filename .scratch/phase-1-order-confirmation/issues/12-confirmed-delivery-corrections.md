# 12: Correct confirmed delivery details

**What to build:** An owning seller updates a confirmed buyer's name, contact or address with visible history while payment acceptance stays unchanged.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** implemented — local acceptance passed; live-authentication acceptance blocked

## Acceptance criteria

- [x] Allow only confirmed name/contact/address corrections with owning-seller identity, reason and expected version; reject token-only edits.
- [x] Keep commercial terms, payment claim/receipt allocation, accepted amount and COD locked; reject extra/forbidden fields server-side rather than ignoring them.
- [x] Retain actor/reason/revision history; do not restart completion or retention time when delivery details change.
- [x] Provide a focused seller correction/history view and clear stale/error handling, preserving entered corrections on recoverable failures.
- [x] Show that portal edits do not update courier bookings; make no courier calls and add no delivery-integration controls.
- [x] Public status remains privacy-limited and confirmed; do not disclose corrected full buyer information through the portal projection.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC28, AC29, AC30, AC37, AC38, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API permitted/forbidden fields, audit, privacy and unchanged-balance checks; real PostgreSQL version/persistence tests; browser delivery correction with unchanged confirmed COD.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Implementation and verification — 2026-10-24

- Delivery-only correction enforcement in `backend/app/services/buyer_correction.py`:
  - When payment claims do not change (including on confirmed orders), allocated receipts and their versions remain completely untouched (`identities = set()`).
  - Terminal/unsubmitted lifecycles report `INVALID_LIFECYCLE` (`409`), while confirmed payment edits report `PAYMENT_FIELDS_LOCKED` (`409`).
  - Rejection of extra/forbidden fields (commercial terms, courier codes/status) via `BuyerCorrection(extra='forbid')` returning `422`.
  - Preserved `completed_at`, `actual_cod_minor`, allocation, and commercial terms intact without restarting completion or retention time.
  - Public portal projection `GET /public/orders/{token}` strictly maintains privacy-limiting allowlist; no corrected buyer name, phone, or address is ever leaked. Public re-submissions on confirmed orders reject with 409 `ORDER_ALREADY_SUBMITTED`.
- Integrated frontend UI in `frontend/src/features/seller/BuyerCorrection.tsx`:
  - Dedicated courier notice explicitly explaining that portal corrections do not update courier bookings.
  - Payment fields disabled with locked explanation note on confirmed orders.
  - Submit button explicitly labeled "Save delivery correction".
  - Refactored `isConfirmed` state and button label logic to remove redundant branching.
  - Resilient stale handling: refreshing order retains draft inputs and clears pending state.
- Focused tests:
  - Backend API: PASS, 13 cases (`npm run test:backend -- tests/test_buyer_corrections.py`).
  - Real PostgreSQL boundary: PASS, 2 cases (`npm run test:backend -- tests/test_corrections_postgres.py`) verifying schema persistence, version bumping, `completed_at` preservation, and atomic conflict rejection.
  - Frontend React: PASS, 3 cases (`npm run test:frontend -- src/features/seller/BuyerCorrection.test.tsx`).
- Full root gate:
  - `npm run check` with `BUYER_TEST_POSTGRES_URL` set to disposable loopback PostgreSQL target (`127.0.0.1:55447`): PASS all 8 stages, 208 backend tests, 61 frontend tests, build, and HTTP smoke.
  - Result artifact: `.cache/checks/check-2gXFXQ/result.json`.
- Live seller login/configured provider: BLOCKED by placeholder verifier in development adapter. Public-access and live credential launch gates remain binding.
- Next action: Proceed with Ticket 13 (Private screenshot upload) or next scheduled ticket.


## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

