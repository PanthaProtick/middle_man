# 07: Organize courier workflows

**Status:** ready-for-agent

**What to build:** Cohesive courier draft, review, submission, reconciliation, and settings workflows whose organization preserves seller control and duplicate-booking protections.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [ ] Use inventory-bounded targets and trace UI, endpoints, services, adapters, fixtures, and tests for each courier responsibility before modifying it.
- [ ] Organize existing modules and colocated tests by owned behavior, decomposing oversized responsibilities without changing external interfaces or schema.
- [ ] Preserve one local draft per confirmation, seller review, parcel/location validation, server-derived remaining COD balance, and independent order-confirmation success.
- [ ] Preserve stale-draft/account revision protection, replay behavior, uncertain-outcome blockers, reconciliation, privacy, and retention guarantees.
- [ ] Preserve localization, entered/provider data, focus/input recovery, and protection against repeated courier actions.
- [ ] Preserve meaningful adapter, API, rendered, replay, failure, and PostgreSQL coverage; verify discovery and fixtures after moves and document narrow size exceptions.
- [ ] Verify each bounded responsibility before proceeding; no live bookings or provider mutations are authorized as cleanup verification.
- [ ] Run final root `npm run check` and record dispositions, exceptions, actual integration results, and unrun hosted/device/live-provider gates.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Backend: `courier_review.py` 234, `courier_reconciliation.py`,
  `courier_attempts.py`, `courier_drafts.py`, `courier_reservation.py`,
  `pathao_*` services, `api/courier.py`, `api/pathao.py`, courier models.
- Frontend: `CourierDraft.tsx` 241, `CourierReview.tsx`, `CourierWorkspace`,
  reconciliation/outcome components, `PathaoSettings.tsx`, courier locale copy
  (coordinate with 08), and their rendered tests.
- Tests: `test_courier_post_submission_changes.py` 495 and
  `test_courier_submission_postgres.py` 402 need split/exception;
  `test_pathao_sandbox_booking.py` 367, `test_courier_submission_failures.py` 301,
  `test_courier_drafts.py` 278, `test_courier_reconciliation_postgres.py` 255;
  `CourierReview.test.tsx` 255 and `CourierPostSubmissionChanges.test.tsx` 235.
- Preserve one local draft per confirmation, seller review, parcel/location
  validation, server-derived COD, stale-revision protection, replay, uncertain
  outcomes, reconciliation, privacy, and duplicate-booking prevention.
- No live booking, provider mutation, or sandbox request is cleanup verification.

**Required checks:** focused courier tests per responsibility, component/API
collection checks, then `npm run check`. Report sandbox/live gates as NOT RUN
unless separately authorized and executed.

