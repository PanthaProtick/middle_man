# 08: Handle changes after submission

**What to build:** A seller correcting delivery details or cancelling an order after courier submission sees an explicit requirement to resolve the booking in Pathao. The original booking snapshot and consignment remain intact, including when the change happens while submission is in flight.

**Blocked by:** 06 — Submit drafts safely through the offline courier adapter.

**Status:** implemented — review fixes verified locally; PostgreSQL/browser/live acceptance remains unverified

- [x] Extend the existing seller correction/cancellation workflow end to end to distinguish an unsubmitted draft from a submitting, unknown, or accepted booking attempt.
- [x] Before reservation/submission, corrections refresh the draft and invalidate stale review, while cancellation prevents submission. Keep the ordering guarantees introduced by protected attempts.
- [x] Once submission is in flight or accepted, retain its reviewed payload, attempt history, booking snapshot, and consignment association. Show which relevant local change requires external seller action.
- [x] A local edit or order cancellation never claims to modify or cancel a Pathao booking and never silently triggers an amendment, cancellation, or replacement request.
- [x] When a booking result or later reconciliation arrives after a local change, preserve the mismatch/external-action notice rather than overwriting it with a generic successful result.
- [x] Keep an unknown attempt protected after local correction/cancellation. Resolving a local change must not erase uncertainty or create a second booking opportunity.
- [x] Preserve accepted payment allocations, COD history, shop isolation, and existing seller delivery-correction authority. Unrelated edits should not fabricate a delivery mismatch.
- [x] Verify API/PostgreSQL races and seller component behavior for correction/cancellation before reservation, during an attempt, after success, and before a delayed result is applied. Include replay, restart, stale requests, and cross-shop denial.
- [x] Run focused tests and root `npm run check` as the final gate. Use the offline adapter; this ticket adds no live provider amendments or cancellation operations.

## Implementation record (2026-10-27)

### Implementation review and fixes (2026-10-27)

- Reviewed commit `dd76c6f` against base `6da2cf2`, tracing API, booking ledger,
  correction/cancellation, replay, and modal component callers.
- Fixed the modal assuming `unsubmitted` before review data loads. Unknown loading
  or failed reads now retain conservative cancellation guidance; an absent local
  attempt no longer claims that no booking exists in Pathao.
- Added explicit attempt-status notifications for submission start, uncertain
  response failure, recovery reads, and reconciliation. Correction/cancellation
  siblings now see in-flight and recovered booking states.
- Submission and reconciliation replays preserve their committed receipts while
  returning the current authorized review. Later delivery changes, cancellation,
  or a newer attempt can no longer be hidden by an old response. No booking or
  evidence lookup is repeated. This deliberately updates the former exact-response
  replay contract; current review/metadata failure can fail the read without
  changing the committed operation.
- Changed service paths: `courier_attempts.py`, `courier_reconciliation.py`.
  Changed UI paths: `CourierReview.tsx`, `CourierWorkspace.tsx`,
  `OrderDetailModal.tsx`, `OrderOutcomes.tsx`. Updated API/submission contracts.
  Added `test_courier_changed_replay.py` (memory and opt-in PostgreSQL cases),
  `CourierStatusPropagation.test.tsx`, and shared component test fixtures;
  retained existing reconciliation ledger assertions while checking current replay.
- Focused backend replay/submission/reconciliation tests: **20 passed**.
  Focused post-submission backend tests: **9 passed, 14 PostgreSQL skipped**.
  Focused frontend component/integration tests: **12 passed**.
- Final `npm run check`: **PASS** — **483 backend passed, 168 skipped**,
  **203 frontend passed**, tooling/lint/types/build/HTTP smoke passed.
  Evidence: `.cache/checks/check-5pkQGG/result.json` and adjacent logs.
  Initial gate `.cache/checks/check-ZXtmV6/result.json` failed with Windows temp
  permissions; rerun used repository-local `TEMP`/`TMP` and passed.
- Limits: PostgreSQL acceptance was skipped because `BUYER_TEST_POSTGRES_URL`
  is unconfigured; no disposable loopback PostgreSQL runtime was available on PATH.
  Browser, physical-device, hosted, and live-provider checks were not run.
  Next acceptance action: run opt-in PostgreSQL races/replay tests against a
  disposable loopback target, then exercise seller flows in a real browser.

- **Mismatch Detection & Typed Contract**:
  - Added `DeliveryMismatch` model to `courier_review.py` (and TypeScript `courierReviewTypes.ts`) tracking `mismatch`, `cancelled`, `recipient_name_changed`, `contact_number_changed`, `address_changed`, `changed_fields`, `booked_snapshot`, and seller action `message`.
  - In `courier_review.read()`, computed mismatch against `latest_attempt.booking_snapshot` for any `submitting`, `unknown`, or `success` attempt.
  - Preserved the mismatch across in-flight submission completions and delayed reconciliation attachments.
  - Ensured unrelated edits without delivery/cancellation changes do not fabricate a mismatch.
- **Pre-reservation Invalidation**:
  - Pre-reservation delivery corrections refresh the draft, update `buyer_revision`, and invalidate previous review approval (`reviewed_token` cleared in DB and memory), forcing re-approval.
  - Pre-reservation order cancellation blocks submission with 409 `INVALID_LIFECYCLE` and marks review with `ORDER_NOT_CONFIRMED`.
- **Protected Attempts & External Action Guarantees**:
  - Neither delivery correction nor order cancellation mutates the attempt ledger, `booking_snapshot`, or `consignment_id`.
  - Zero calls are dispatched to modify or cancel bookings in Pathao.
  - Unknown attempts remain strictly protected after local correction/cancellation; resubmission remains blocked until explicitly reconciled.
- **Seller UI Integration**:
  - `CourierReview` prominently renders mismatch warnings directing the seller to resolve in Pathao, displaying the original booked snapshot.
  - `BuyerCorrection` distinguishes unsubmitted draft from in-flight (`submitting`), outcome unknown (`unknown`), and confirmed (`success`) booking attempts.
  - `OrderOutcomes` warns when cancelling an order with an in-flight, unknown, or confirmed courier booking that Pathao is not automatically cancelled.
- **Verification**:
  - Focused backend tests in `test_courier_post_submission_changes.py` (9 passed).
  - PostgreSQL concurrency/race tests in `test_courier_submission_postgres.py`.
  - Frontend component tests in `CourierPostSubmissionChanges.test.tsx` (5 passed), plus full suite (196 passed).

