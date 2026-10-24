# 18: Run raw-evidence cleanup and expose failures

**What to build:** Raw SMS, screenshots and AI evidence are removed when their original 30-day deadlines arrive, and overdue cleanup is visible and recoverable.

**Blocked by:** [06: Import payment SMS with manual fallback](06-sms-import.md); [13: Attach optional screenshots privately](13-private-screenshot-upload.md); [14: Use optional AI address suggestions](14-ai-address-assistance.md); [15: Use optional AI screenshot extraction](15-ai-screenshot-extraction.md)

**Status:** in-review

## Acceptance criteria

- [x] Run durable retryable cleanup against existing ownership/collection/deadline metadata for SMS, images, raw model requests/responses and failed/orphan staged uploads.
- [x] Use original collection deadlines; reprocessing cannot reset them. Remove raw originals even where structured records remain necessary for unresolved orders.
- [x] Evidence reads show explicit unavailability after deletion; order status, structured claims, accepted allocation, COD and used-payment markers remain unchanged.
- [x] Expose owning-seller appropriate evidence deletion status and operational overdue/failure information without logging raw evidence or other shops' records.
- [x] Handle storage/database outage and restart with safe repeat deletion; never acknowledge complete deletion before required copies are removed.
- [x] Document and verify lifecycle for storage version history, backups and provider/log copies; unknown external purge behavior stays an explicit live-data gate rather than a false deletion claim.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC17, AC39, AC40, AC42, AC43, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

Frozen-time API and real PostgreSQL cleanup scheduling/restart/dependency tests; storage fault injection and replay-after-raw-deletion checks; browser retained-record/evidence-unavailable display; configured storage/purge evidence separately.

- Implemented durable retryable cleanup in `app.services.raw_evidence_cleanup.purge_raw_evidence` and `get_retention_status`:
  - Enforces original 30-day collection deadlines across images, raw SMS text, AI address requests/responses, and AI payment responses.
  - Safe removal of raw originals while preserving structured claims, order lifecycle, allocations, COD, and used-payment markers.
  - Replay / re-import after raw SMS deletion observes tombstone digest (`uq_sms_evidence_digest`), preventing duplicate funds or allocations (AC17).
  - Storage outage handling with fault injection: never acknowledges deletion or marks records deleted in DB if file unlinking fails; exposes failed and overdue counts safely.
  - Rerunning cleanup after outage recovery completes deletion cleanly.
- Added migration `0016_raw_evidence_cleanup.sql` with `evidence_cleanups` table and `EvidenceCleanupTable` model.
- Added seller retention endpoints: `GET /api/seller/retention/status` and `POST /api/seller/retention/cleanup`.
- Fixed `EvidenceService.get_seller_evidence` to return 410 `EVIDENCE_UNAVAILABLE` when status is deleted or deleted_at is set.
- Built React component `EvidenceRetentionPanel.tsx` in `SellerWorkspace.tsx` with loading, status counts, overdue warning, and trigger/retry actions.
- Documented raw evidence retention and lifecycle launch gates in `docs/API_CONTRACTS.md`.
- Focused checks PASS:
  - Backend tests: `npm run test:backend -- tests/test_raw_evidence_cleanup.py tests/test_evidence_routes.py tests/test_seller_routes.py` (24 passed).
  - Frontend tests: `npm run test:frontend -- src/features/seller/EvidenceRetentionPanel.test.tsx` (3 passed).
  - Strict typecheck: `npm run typecheck` (77 backend source files and frontend tsc passed).
- Real PostgreSQL and live provider checks:
  - Unit tests run offline with disposable mock stores; live production migration, hosted storage bucket versioning, external backup purge, and third-party AI provider logs remain explicit launch gates (NOT RUN).
- Next action: run full root `npm run check`, perform two-axis code review (standards and spec), and commit to current branch.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

