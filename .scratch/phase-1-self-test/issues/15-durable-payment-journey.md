# 15: Verify durable receipt-to-confirmation behavior

**What to build:** Use synthetic manual/SMS transaction records to confirm an eligible submitted order exactly once with correct remaining COD.

**Blocked by:** 03: Separate payment-marker protection from Clerk credentials; 08: Submit once and recover an uncertain response.

**Status:** completed

## Acceptance criteria

- [x] Both receipt/submission arrival orders produce the same qualifying durable confirmation; unsupported SMS stays visibly unresolved with manual entry and no AI call.
- [x] Exact provider/account/TrxID/sender/amount/time checks and duplicate observation handling remain intact; masked/ambiguous data is not guessed.
- [x] Restart and same-key retries preserve fixed terms, one allocation, accepted amount and consistent seller/buyer COD.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing receipt entry/import, deterministic reconciliation, allocation and seller/buyer status surfaces.

## Verification target

Run existing focused PostgreSQL receipt/SMS/matching cases and add only demonstrated-gap regressions; record one synthetic seller-to-buyer confirmation journey.

Coverage: AC03, AC06, AC08, AC12–AC18, AC21, AC37, AC39, AC49. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Rewriting completed reconciliation or claiming representative live-SMS support.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Implementation details & decisions

1. **Both arrival orders on real PostgreSQL (AC12, AC16)**:
   - Verified that both arrival orders (manual receipt first -> buyer claim, and buyer claim first -> manual receipt) produce identical qualifying durable confirmations in PostgreSQL.
   - In both cases, exactly one allocation record is created in `allocations`, exactly one marker in `used_payment_markers`, order lifecycle reaches `confirmed`, and both seller and buyer projections agree on actual remaining COD (`total_minor - accepted_amount_minor`).
2. **Unsupported SMS & manual entry fallback without AI (AC49, AC13, AC14)**:
   - Verified that unsupported SMS structures parse deterministically to `unsupported` and remain unresolved without triggering any external Gemini AI request.
   - Order remains in `pending` review status with zero allocations until seller manually records the verified transaction, smoothly achieving automatic reconciliation and confirmation.
3. **Cross-shop isolation with identical TrxID (AC03)**:
   - Verified that independent shops processing identical transaction IDs (`TRX-CROSS-SHOP-SHARED`) create isolated markers and allocations scoped by `shop_id` without collision or global locking.
4. **Bangla digits & sender canonicalization (AC08)**:
   - Verified matching between buyer submission with Bangla numerals (`০১৮২২২২২২২২` / `+880` representation) and seller receipt with ASCII digits (`01822222222`).
5. **Contradictory observations & late claims (AC18, AC21)**:
   - Verified that arrival of contradictory receipts after confirmation preserves the existing confirmed order and its allocation, flagging `has_conflict=True` on the observation to alert the seller.
6. **Restart durability & same-key replay idempotency (AC37, AC39)**:
   - Verified same-key retries of buyer submissions and seller manual transactions return identical cached 200 responses without creating duplicate allocations or transactions.
   - Verified that after complete in-memory store reset, seller and buyer API queries retrieve identical intact confirmed orders with consistent COD.
7. **Modular test decomposition**:
   - Organized regressions across focused test files (`test_durable_confirmation_postgres.py`, `test_durable_confirmation_journey_postgres.py`, `test_reconciliation_isolation_postgres.py`, `test_reconciliation_invariants_postgres.py`), keeping all test files strictly between 127 and 201 lines (well below the 250–300 limit).

## Verification results

- **Focused PostgreSQL tests (port 55447 disposable cluster)**:
  - `tests/test_durable_confirmation_postgres.py`: 3 passed (both arrival orders, restart durability, same-key replays).
  - `tests/test_durable_confirmation_journey_postgres.py`: 1 passed (full synthetic seller-to-buyer journey).
  - `tests/test_reconciliation_isolation_postgres.py`: 2 passed (unsupported SMS recovery, cross-shop isolation).
  - `tests/test_reconciliation_invariants_postgres.py`: 2 passed (Bangla digits, contradictory observations).
  - `tests/test_reconciliation_postgres.py`: 2 passed.
  - `tests/test_sms_postgres.py`: 5 passed.
  - Combined suite: 15 passed in 4.97s.
- **Full backend test suite with PostgreSQL enabled**:
  - `npm run test:backend`: 472 passed in 37.92s (0 failed, 0 skipped).
- **Frontend test suite**:
  - `npm run test:frontend`: 31 files, 146 passed in 4.85s.
- **Typechecking & Linting**:
  - `npm run typecheck`: clean (94 Python source files, TypeScript noEmit clean).
  - `npm run lint`: clean (0 ruff warnings, 0 oxlint warnings/errors across 99 files).
- **Final root verification gate**:
  - Command: `npm run check` (Run ID: `check-pNZccb`)
  - Result: Exit code 0 (All 8 stages passed)
    - PASS Tooling tests (0.5s)
    - PASS Backend lint (0.0s)
    - PASS Backend types (0.4s)
    - PASS Backend tests (6.1s)
    - PASS Frontend lint (0.2s)
    - PASS Frontend test (5.4s)
    - PASS Frontend build (1.0s)
    - PASS HTTP smoke (1.8s)

## Unresolved risks & gaps

- None for local offline self-test.
- Real Clerk/Neon hosted browser acceptance is reserved for integration ticket 20/22. Mocks and loopback HTTP smoke do not prove third-party hosted network availability.

## Next action

- Proceed to unblocked dependent ticket 16: `Verify conflict and correction recovery`.

## Comments

- Published from the user-approved 22-ticket breakdown on 2026-10-24.
- 2026-10-25: Verified durable receipt-to-confirmation behavior across both arrival orders, unsupported SMS fallback, cross-shop isolation, Bangla digits canonicalization, time boundary enforcement, same-key replays, and restart durability against PostgreSQL on port 55447. All tests and root verification gate passed.
