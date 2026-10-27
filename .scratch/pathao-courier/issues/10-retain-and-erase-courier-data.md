# 10: Include courier data in retention cleanup

**What to build:** Existing seller retention visibility and maintenance operations account for courier data, remove due personal delivery information and sensitive replays, and retain only the minimum references needed to prevent payment reuse or unsafe repeat booking.

**Blocked by:** 07 — Resolve unknown booking outcomes; 08 — Handle changes after submission.

**Status:** done

- [x] Integrate draft metadata, reviewed payload snapshots, attempt/booking records, and reconciliation details with the existing structured/evidence-retention boundaries. Do not create an unrelated retention schedule or change the agreed production retention policy.
- [x] Use existing seller retention operations and UI/status conventions to make cleanup behavior and safe failures observable. Preserve shop scoping, server-owned deadlines, and explicit database-unavailable behavior.
- [x] Erase due buyer names, contact/address details, raw payload copies, and sensitive cached/idempotent responses so replay, status, audit, or seller views cannot resurrect removed personal data.
- [x] Retain only the minimal nonpersonal attempt/association/tombstone data required to prevent another booking and the existing consumed-payment safeguards. Cleanup of an unresolved attempt cannot make the order submit-ready or imply its external booking was cancelled.
- [x] Existing retention deadlines are not reset by corrections, booking, settings changes, retries, or reconciliation. Seller accounts/settings and connection secrets are not incidentally deleted with an order; keep their dedicated access/security boundaries.
- [x] Bound provider-error and audit retention; do not store raw responses indefinitely or duplicate merchant secrets into history. Ordinary raw-evidence cleanup continues to respect its existing independent deadline.
- [x] Verify on disposable PostgreSQL data using the existing retention/API seams: due/not-due boundaries, cross-shop isolation, complete redaction, unknown/booked protection, replay after cleanup, partial failure, repeat execution, and restart.
- [x] Add component coverage where retention status or removed-order behavior changes, and confirm old buyer links cannot expose retained personal courier data.
- [x] Run focused tests and root `npm run check` as the final gate. Do not claim application-row cleanup purges external object versions, logs, or database backups.

## Implementation — 2026-10-27

- Existing structured cleanup now clears attempt snapshots, review fingerprints and
  provider errors, deletes reconciliation details, and redacts replay receipts by
  order/revision/attempt identity, including pending resolution receipts. Draft
  metadata and buyer details use the existing deletion path. Attempt audit records
  share the same cleanup boundary.
- Retain attempt IDs, order/shop/environment, outcome/version and consignment
  association as duplicate-booking guards. Erasure does not cancel a booking or
  turn an unknown outcome into a retryable failure. Payment markers remain intact.
- Reconciliation rechecks the retained-order boundary under its existing lock
  after provider lookup, preventing a late resolution from restoring erased data.
- No new schedule, migration, API shape or UI state. The first completion deadline,
  independent raw-evidence deadline, settings and encrypted connection revisions
  remain under their existing boundaries. Existing seller retention counts and
  safe failure codes cover courier cleanup; removed-order routes return `410`.
- Changed sources: `backend/app/services/courier_retention.py`,
  `courier_reconciliation_resolution.py`, `structured_retention_db.py`,
  `structured_retention_memory.py`; tests: `backend/tests/test_courier_retention.py`.
- TDD: reproduced an unknown attempt retaining its recipient snapshot after cleanup;
  implemented redaction and reran successfully. Six focused tests now pass, including
  disposable PostgreSQL boundary, restart/session recovery, booked/unknown protection,
  resolution and pending replay erasure, shop isolation, settings preservation,
  rollback/retry and cleanup during provider lookup.
- `npm run typecheck`: PASS. Standards review: 0 findings. Spec review: 0 findings.
- Initial final gate `.cache/checks/check-S67iNu/result.json`: FAIL at backend
  tests, 645 passed and 32 setup errors because Windows denied pytest access to
  the host temporary directory. Retrying the full gate with repository-local
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-courier-retention-final`:
  `.cache/checks/check-pwZ9aF/result.json`: PASS all eight stages; 677 backend tests and 204 frontend tests passed, including the disposable PostgreSQL cases.
- PostgreSQL uses a task-owned UTF-8 cluster bound to `127.0.0.1:55519`, with each
  fixture creating and dropping its own schema. No hosted database or live Pathao
  calls. PostgreSQL recovery checks reopen database sessions; no OS process restart
  is claimed. Application-row erasure does not purge external object versions,
  provider systems, logs, or database backups.
- Preserve all pre-existing Ticket 09 checkout changes; stage only the paths above
  and this ticket. Final gate and both reviews passed; implementation complete.
