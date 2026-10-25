# 16: Verify conflict and correction recovery

**What to build:** Resolve synthetic conflicts and corrections through existing seller review paths without losing audit history or duplicating payment allocation.

**Blocked by:** 15: Verify durable receipt-to-confirmation behavior.

**Status:** completed

## Acceptance criteria

- [x] Competing claims and contradictory records remain held for review; seller decisions/corrections retrigger only eligible matching and preserve immutable revisions.
- [x] Manual exceptions require owning authority, receipt, reason and valid amount/COD preview; over-total payments and confirmed commercial-term edits stay rejected.
- [x] Cancellation/rejection and post-confirmation observations preserve the accepted allocation and payment protection; stale versions and changed-payload retries cannot overwrite outcomes.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing evidence resolution, pending/confirmed delivery corrections, receipt corrections, exception preview and lifecycle decisions.

## Verification target

Use the existing bounded scenario fixtures for conflict resolution, correction, exception and cancellation; retain assertions and add regressions only for observed failures.

Coverage: AC19–AC21, AC24–AC30, AC34–AC35, AC38. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

New matching rules, refunds, courier side effects or broad service rewrites. If a failure spans multiple domain owners, record it and split the fix before expanding scope.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Implementation details & decisions

1. **Competing claims & contradictory records held without first-submitter winner (AC19, AC20)**:
   - Verified that two orders claiming an identical transaction ID remain held in `pending` review status with `COMPETING_CLAIMS`.
   - Verified that contradictory observations for the same transaction hold the receipt in `has_conflict=True` (`CONFLICTING_RECEIPTS`) with zero allocations in PostgreSQL.
   - Verified that seller evidence resolution (`POST /api/seller/transactions/{id}/resolve`) selects the valid observation and order with an audited reason (`evidence_resolved` in `audit_events`), creating exactly one allocation and marker in PostgreSQL, leaving the competing order held (`held_by_resolution=True`).

2. **Pending order recovery via seller buyer correction (AC27)**:
   - Verified that the held second order is cleanly recovered by the seller through `PATCH /api/seller/orders/{id}/buyer-details` by updating its payment claim to its verified TrxID.
   - The prior buyer revision is immutably retained in `buyer_revisions`, `revision_number` increments, and reconciliation re-runs automatically upon receipt entry, achieving full confirmation with its own isolated allocation and marker.

3. **Post-confirmation contradictory observations & late claims (AC21)**:
   - Verified that contradictory receipts arriving after confirmation preserve the confirmed order, its allocation, and used payment markers in PostgreSQL, while flagging `has_conflict=True` on the receipt as a seller alert.
   - Verified that late buyer claims submitted after confirmation for the same TrxID preserve the existing confirmation and are held in `pending` review without re-allocating.

4. **Manual exceptions & over-total guard (AC24, AC25, AC26, AC28)**:
   - Verified exception preview (`GET /api/seller/orders/{id}/payment-preview`) for advance amount mismatches within total: preview displays `AMOUNT_MISMATCH` exception, accepted amount, and recalculated actual COD.
   - Confirmed manual decision commits the exception, stores audit details, and updates actual COD matching preview.
   - Over-total payments (receipt > total) produce `PAYMENT_EXCEEDS_TOTAL` blocker and `actual_cod_minor=None`; attempted confirmation fails with 409 `PAYMENT_EXCEEDS_TOTAL` and attempted split allocation fails with 409/422 with no partial credit or negative COD.
   - Negative manual confirmation paths fail without state mutation: missing transaction ID (422), blank reason (422), and cross-shop order ID (404).
   - Anonymous / unauthenticated attempts to access seller buyer-details endpoint fail closed with 401 (AC28).

5. **Confirmed delivery corrections vs locked commercial/payment terms (AC29, AC30)**:
   - Verified that delivery address and contact updates on confirmed orders succeed, creating audit revisions while leaving payment allocation and balances unchanged.
   - Attempting to modify payment claim fields on a confirmed order is strictly rejected with 409 `PAYMENT_FIELDS_LOCKED`.

6. **Durable cancellation & rejection (AC34, AC35)**:
   - Cancelling an unconfirmed order terminates the order and stops future matching.
   - Cancelling a confirmed order transitions lifecycle to `cancelled` and writes `order_cancelled` audit event, but critically does NOT delete or free the allocation or payment marker in PostgreSQL (`allocations` count remains 1, `used_payment_markers` remains present, and rival orders cannot claim the transaction).
   - Rejecting a pending order transitions lifecycle to `rejected` and locks out buyer resubmission with 409 `ORDER_ALREADY_SUBMITTED`. Confirmed orders cannot be rejected.

7. **Idempotency & version conflict protection (AC38)**:
   - Replaying mutations with the same `Idempotency-Key` and payload returns cached responses without re-execution.
   - Replaying with the same key but different payload returns 409 `IDEMPOTENCY_KEY_REUSED`.
   - Calling mutations with stale versions returns 409 `STALE_VERSION`.

8. **Contract documentation alignment**:
   - Updated `docs/API_CONTRACTS.md` for `POST /api/seller/orders/{id}/decisions` to reflect support for `confirm`, `cancel`, and `reject` actions, their required payload fields, and domain guarantees.

9. **Restart durability & modular decomposition**:
   - Verified that clearing in-memory stores (`reset_order_memory_store`, `reset_transaction_memory_store`, `reset_memory_store`) preserves all confirmed, cancelled, and rejected states, allocations, and markers in PostgreSQL.
   - Decomposed test coverage into two modular files:
     - `backend/tests/test_payment_recovery_journey_postgres.py` (288 lines): End-to-end synthetic recovery journey.
     - `backend/tests/test_conflict_resolution_invariants_postgres.py` (227 lines): Invariant checks for cancellation, rejection terminality, over-total rejection, and idempotency conflicts.
   - Both files strictly satisfy the 250–300 line limit.

## Changed paths

- `backend/tests/test_conflict_resolution_invariants_postgres.py`: Invariant regression tests on PostgreSQL.
- `backend/tests/test_payment_recovery_journey_postgres.py`: Complete synthetic recovery journey on PostgreSQL.
- `docs/API_CONTRACTS.md`: Documented `confirm`, `cancel`, and `reject` decision actions on orders.
- `.scratch/phase-1-self-test/issues/16-payment-review-recovery.md`: Updated ticket record.

## Verification results

- **Focused PostgreSQL tests (port 55447 disposable cluster)**:
  - `tests/test_payment_recovery_journey_postgres.py`: 1 passed (full conflict and recovery journey).
  - `tests/test_conflict_resolution_invariants_postgres.py`: 3 passed (confirmed cancellation preservation, pending rejection terminality, over-total and idempotency invariants).
  - `tests/test_resolution_postgres.py`: 5 passed.
  - `tests/test_payment_exceptions_postgres.py`: 5 passed.
  - `tests/test_corrections_postgres.py`: 2 passed.
  - `tests/test_receipt_correction_postgres.py`: 7 passed.
  - `tests/test_order_outcomes_postgres.py`: 3 passed.
  - Combined suite: **26 passed** in 11.34s.
- **Full backend test suite with PostgreSQL enabled**:
  - `npm run test:backend`: **478 passed** in 40.58s (0 failed, 0 skipped).
- **Frontend test suite**:
  - `npm run test:frontend`: 31 files, **146 passed** in 4.94s.
- **Typechecking & Linting**:
  - `npm run typecheck`: clean (94 Python source files, TypeScript `noEmit` clean).
  - `npm run lint`: clean (0 ruff warnings, 0 oxlint warnings/errors across 99 files).
- **Final root verification gate**:
  - Command: `npm run check` (Run ID: `check-vijQsv`)
  - Result: Exit code 0 (All 8 stages passed: Tooling tests, Backend lint, Backend types, Backend tests, Frontend lint, Frontend test, Frontend build, HTTP smoke).

## Unresolved risks

- Concurrency under high worker contention and deadlocks: Covered for normal two-worker resolution contention in `test_resolution_postgres.py`; ticket 17 covers deeper multi-worker contention and outages.
- Courier booking side-effects: Outside scope of this ticket; manual delivery address updates do not interact with live courier endpoints.

## Next action

- Proceed to **Ticket 17**: Verify payment contention and database outages under concurrent workers and transient connection failures.

## Comments

- Published from the user-approved 22-ticket breakdown on 2026-10-24.
- 2026-10-25: Verified conflict and correction recovery behavior across competing claims, contradictory observations, evidence resolution, seller delivery corrections, post-confirmation observation alerts, manual exceptions, over-total rejection, confirmed cancellation allocation preservation, pending rejection terminality, and restart durability against PostgreSQL on port 55447. All tests and root verification gate passed.
