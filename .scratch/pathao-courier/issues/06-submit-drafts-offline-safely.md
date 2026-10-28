# 06: Submit drafts safely through the offline courier adapter

**What to build:** A seller can exercise the complete reviewed-draft submission flow against an explicitly simulated courier, with persistent attempt tracking, reliable result states, and duplicate protection before any real booking is enabled.

**Blocked by:** 05 — Review a booking-ready draft.

**Status:** implemented — reported gaps resolved; local verification complete

## Privacy fix and final verification (2026-10-27)

This resolution supersedes the remaining failure recorded in the recheck below.

- Removed keyword-based rejection filtering. Definitive failures now always use
  controlled application text; the handler never converts raw rejection details
  to seller-facing or persisted strings. The trade-off is generic rejection
  guidance until a future provider supplies explicit, mapped reason codes.
- Extended permanent API/privacy regressions to cover unexpected exceptions,
  definitive exceptions containing secret keywords, and definitive exceptions
  containing private payload values without those keywords. Tests assert safe
  POST/GET responses, safe stored attempt data, failed-versus-unknown status,
  and retry eligibility. Changes: `courier_outcomes.py`, `courier_attempts.py`,
  `test_courier_submission_failures.py`, `docs/pathao-submission-contract.md`.
- Focused submission suite: 17 passed. Expanded retained verification probe:
  2 passed. Temporary test copy removed after execution.
- Final root `npm run check`: all eight gates PASS; result
  `.cache/checks/check-gVUWzA/result.json`, backend 455 passed / 144 skipped.
  Used repository-local TEMP/TMP. PostgreSQL was not rerun because this shell
  has no disposable test URL; prior PostgreSQL evidence is recorded below.
  Browser/live-provider/physical-device acceptance remains unrun.
- `git diff --check` still flags existing EOF blank lines in submission model,
  provider and submission test files; no functional gate failed.
- No further work remains for the reported three gaps. No commit was made;
  unrelated checkout changes were preserved.

## Independent recheck (2026-10-27)

- Reservation now performs final checks under locks through commit; the prior
  premature-commit gap is addressed by inspection. Malformed-success and
  unexpected-exception privacy probes now pass (2/2 original probes).
- Remaining reproducible failure: `sanitize_definitive_error` returns raw
  rejection messages unless a keyword regex matches. A definitive rejection
  containing `Rejected payload: synthetic-private-value, 01711111111, House 42`
  is persisted verbatim and exposed in GET courier-review. Keyword absence
  does not establish that provider text is safe. Use controlled error codes
  and allowlisted seller-facing messages rather than raw exception text.
- Expanded reproducer was retained during this investigation at
  `.scratch/pathao-courier/test_ticket06_definitive_privacy_probe.py` and
  temporarily copied into `backend/tests/` to execute. Result: 1 passed / 1 failed
  (definitive-error privacy). The disposable probe was removed during repository
  cleanup; its coverage now lives in `backend/tests/test_courier_submission_failures.py`.
- Current focused submission tests plus original probes: 17 passed, 10
  PostgreSQL tests skipped because this shell has no test database URL.
  Independently inspected prior `check-hYNexB` result and backend log:
  all eight gates PASS, 597 backend tests passed without skips. That historical
  evidence supports prior PostgreSQL execution but misses the privacy case.
- No implementation fixes made. Prior completion statements below are
  superseded by this remaining acceptance failure.
- Fresh root `npm run check`: all eight gates PASS, result
  `.cache/checks/check-9v6HWb/result.json` (453 backend passed, 144 skipped).
  The expanded failing probe is retained outside the ordinary suite. Browser
  and live-provider acceptance were not run.

## Completion verification (2026-10-27)

All three verification findings from independent review have been addressed and verified against a disposable PostgreSQL database on loopback port 5432:

- **Reservation race closed**:
  - `reserve_attempt` decomposes into unlocked initial review preparation (`courier_review.read`) followed by atomic locked validation in `courier_reservation.reserve_attempt`.
  - Row locks (`ShopTable.with_for_update()`, `OrderTable.with_for_update()`, `CourierDraftTable.with_for_update()`, and `CourierAttemptTable.with_for_update()`) are acquired and held continuously through final freshness (`expected_token` vs draft fingerprint), lifecycle (`order.lifecycle == 'confirmed'`), settings version (`PathaoConnectionTable.version`), approval check (`marker_value(record, 'reviewed_token') == expected_token`), and attempt ledger state checks until `await db.commit()`.
  - Provider I/O (`pathao_provider.submit_booking`) executes strictly outside of any database transaction.
- **Malformed success protection**:
  - Extracted `validate_booking_result` in `app/services/courier_outcomes.py`.
  - Rejects empty consignment IDs, mismatched merchant order references, and inconsistent simulation flags.
  - Ambiguous or malformed provider confirmations are safely classified as `unknown` outcome (`error_code='MALFORMED_SUCCESS'`), protecting the order attempt and blocking resubmission (HTTP 504 `COURIER_OUTCOME_UNKNOWN`).
- **Error privacy**:
  - Extracted `sanitize_definitive_error` and `sanitize_unexpected_error` in `app/services/courier_outcomes.py`.
  - Raw exceptions (e.g. injected synthetic secrets or provider payloads) are never persisted verbatim or exposed to sellers.
  - Unexpected exceptions are sanitized into safe generic messages (`'Courier submission encountered an unexpected provider error.'`, `COURIER_OUTCOME_UNKNOWN` or `COURIER_TIMEOUT`).
- **Permanent regressions & deterministic PostgreSQL tests**:
  - Reproducer probe converted into permanent test cases in `backend/tests/test_courier_submission_failures.py`:
    - `test_submission_malformed_success_classified_as_unknown` (parameterized for empty consignment, wrong order, inconsistent simulation flag)
    - `test_submission_error_privacy_sanitizes_raw_exceptions`
    - Disposable probe `test_ticket06_verification_probe.py` passed 2/2 before it
      was removed during repository cleanup.
  - Deterministic real PostgreSQL tests in `backend/tests/test_courier_submission_postgres.py` (10 passed, 0 skipped against disposable loopback PostgreSQL cluster on port 5432):
    - `test_postgres_simultaneous_submission_concurrency`: Concurrent submissions serialize; one succeeds (200), one conflicts (409).
    - `test_postgres_correction_during_reservation`: Interleaved draft correction invalidates stale review (409 `STALE_VERSION`), creating 0 attempt rows.
    - `test_postgres_cancellation_during_reservation`: Interleaved order cancellation rejects reservation (409 `INVALID_LIFECYCLE`), creating 0 attempt rows.
    - `test_postgres_restart_recovery`: Orphaned `submitting` attempts in PostgreSQL recover durably as `unknown` with `INTERRUPTED_IN_FLIGHT` on first read, locking draft and resubmissions.
- **Verification gate results**:
  - Focused backend courier tests (with PostgreSQL enabled): 51 passed (`test_courier_drafts.py`, `test_courier_review.py`, `test_courier_submission.py`, `test_courier_submission_failures.py`, `test_courier_submission_postgres.py`, `test_courier_review_postgres.py`).
  - Focused seller frontend tests: 8 passed (`CourierReview.test.tsx`).
  - Full root `npm run check` with disposable PostgreSQL enabled: **PASS** across all 8 gates (Tooling, Backend lint, Backend types, Backend tests [597 passed, 0 failed, 0 skipped in 90.73s], Frontend lint, Frontend test, Frontend build, HTTP smoke). Run ID: `check-hYNexB` (`.cache/checks/check-hYNexB/result.json`).
  - Zero live network calls demonstrated via socket guard fixtures. Real Pathao API, Clerk production authentication, and physical device boundaries remain unchanged and explicitly unverified by unit/integration tests.


## Implementation record (2026-10-27)

- Added authenticated seller submission action and UI progress/result states against the offline courier adapter only. Real and production booking remains unavailable and rejected server-side (`REAL_BOOKING_DISABLED`).
- Migration 0024 (`0024_courier_submissions.sql`) creates durable `courier_attempts` ledger with unique constraint `(order_id, attempt_number)`, unique partial index `order_id WHERE status = 'success'`, and unique partial index `order_id WHERE status IN ('submitting', 'unknown')`.
- Reservation rechecks confirmation, cancellation, review freshness (`expected_token`), metadata readiness, store ownership, and environment (`offline`) under shop/order row locks before persisting `status = 'submitting'`.
- Provider call (`pathao_provider.submit_booking`) runs strictly outside database transactions. Request mapping verifies recipient contact, address, location hierarchy, pickup store, parcel weight/quantity, and integer BDT COD conversion (zero collection for prepaid; overpayment rejected).
- Outcomes classified conservatively: simulated success generates `SIM-PATHAO-...` and records durable booking snapshot; definitive failures record error and leave draft editable and retryable; unknown outcomes (timeouts, connection disconnects, provider acceptance followed by local save failure, restart recovery) protect attempt and block resubmission until reconciled.
- Process crash / restart while in `submitting` status recovers durably as `unknown`. Draft parcel details and review updates are locked while attempt is active, unknown, or booked.
- Frontend `CourierReview.tsx` handles duplicate click prevention, submission progress, simulated consignment details, definitive rejection alerts with retry, protected unknown outcome banners, and session loss retry.
- Contract documented in `docs/pathao-submission-contract.md`.
- Acceptance boundaries: Zero live network calls (enforced by socket rejection fixtures). Real Pathao/Clerk, sandbox booking, hosted migrations, and physical devices: NOT RUN. External provider acceptance is explicitly NOT established by this ticket.

## Standards review

- Addressed line count ceiling: split tests into `test_courier_submission.py` (211 lines) and `test_courier_submission_failures.py` (193 lines). All source files remain strictly under 250–300 lines.
- Extracted shared `assert_order_allows_edits` helper in `courier_attempts.py` to eliminate code duplication across review and draft services.
- Replaced raw string outcome types with explicit `AttemptStatus = Literal['submitting', 'success', 'failed', 'unknown']`.
- Independent follow-up: **0 remaining Standards findings**.

## Spec review

- Boundary validations added in `submit_booking` for recipient contact, complete address, store, city/zone IDs, positive weight and item quantity.
- Added session loss / unauthorized 401 test in `CourierReview.test.tsx` verifying error display and retry enablement.
- Durable persistence of in-flight recovery on restart verified.
- Added explicit acceptance disclaimer regarding zero live network calls and offline simulation boundaries.
- Independent follow-up: **0 remaining Spec findings**.

## Check results

- Focused backend courier tests: 51 passed across unit and PostgreSQL integration suites (`test_courier_submission.py`, `test_courier_submission_failures.py`, `test_courier_submission_postgres.py`, `test_courier_review.py`, `test_courier_drafts.py`, `test_courier_review_postgres.py`).
- Focused seller frontend tests: 8 passed (`CourierReview.test.tsx`).
- Root `npm run check` with disposable PostgreSQL enabled: **PASS** across all 8 gates (Tooling, Backend lint, Backend types, Backend tests [597 passed, 0 failed, 0 skipped in 90.73s], Frontend lint, Frontend test, Frontend build, HTTP smoke). Run ID: `check-hYNexB` (`.cache/checks/check-hYNexB/result.json`).


- [x] Deliver the explicit authenticated seller submission action and UI progress/result states against the offline adapter only. Identify simulated consignments/results clearly; server-side controls must keep real and production booking unavailable.
- [x] Recheck confirmation, cancellation, review freshness, metadata readiness, store ownership, and environment before reserving an attempt. Bind the attempt to a versioned reviewed payload and stable correlation reference.
- [x] Persist the attempt before a potential external side effect. Serialize submissions per order and enforce one booking association per order; same-key replay, new idempotency keys, repeated clicks, and concurrent requests cannot bypass an existing submitting, unknown, or booked attempt.
- [x] Define ordering with concurrent corrections and cancellation: changes committed before reservation invalidate review; changes after the attempt is committed/in flight cannot imply the external operation was cancelled or updated. Never hold a database transaction across a provider call.
- [x] Simulated success records a durable consignment association and booking snapshot. Definitive noncreation failures remain editable/retryable; unknown outcomes remain protected and visibly block another attempt.
- [x] Classify timeout, interrupted in-flight work, malformed success, ambiguous server responses, accepted-but-response-lost, and provider acceptance followed by local persistence failure conservatively as unknown. Do not infer safe retry solely from an HTTP status or elapsed timeout.
- [x] Restart recovers or protects unfinished attempt state. Changing connection/defaults, editing a draft, or sending a different idempotency key cannot silently clear a protected attempt.
- [x] Verify the request mapping at the single courier boundary: recipient contact, complete address, selected location/store/service, explicit quantity/weight, and exact minor-unit COD conversion, including zero collection. Preserve existing overpayment rejection.
- [x] Courier errors leave the committed confirmed order and accepted advance intact. Typed responses and UI errors contain no raw credentials or unnecessary buyer/provider payloads.
- [x] Through API/PostgreSQL tests, cover concurrency, replay, restart, stale review, correction/cancellation ordering, persistence failure after simulated acceptance, and every failure classification. Add seller component tests for duplicate clicks, progress, success, rejection, unknown, and session loss.
- [x] Run focused tests and root `npm run check` as the final gate. Demonstrate zero live network calls in ordinary tests and explicitly record that external provider acceptance is not established by this ticket.
