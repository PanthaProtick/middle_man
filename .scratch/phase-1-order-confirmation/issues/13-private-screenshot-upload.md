# 13: Attach optional screenshots privately

**What to build:** A buyer optionally attaches a valid payment screenshot and the owning seller can retrieve it privately, while the manual form stays usable.

**Blocked by:** [03: Submit buyer details and see pending status](03-manual-buyer-submission.md)

**Status:** ready-for-agent

## Acceptance criteria

- [x] Accept JPEG/PNG up to initial 5 MiB/20 megapixel limits, checking actual decoded content/dimensions and stripping metadata; reject invalid MIME/content, excessive images and foreign evidence references.
- [x] Bind private evidence to order/shop and authorized non-live/live-policy scope; only owning sellers retrieve evidence through a short-lived private access mechanism, never public object URLs.
- [x] Permit upload only for unsubmitted, unexpired orders. Upload cannot extend expiry, count as submission, or confirm receipt; public operations remain subject to the existing live gate.
- [x] Create collection/deletion deadlines and durable orphan/failed-upload tracking immediately; raw evidence expires after 30 days and raw copies stay out of logs/audit.
- [x] Support idempotent staged uploads and unknown-outcome recovery without falsely claiming uploaded content exists during a storage outage.
- [x] Provide upload progress/success/error/removal-from-form states and seller evidence view; manual submission remains possible when upload fails or is skipped. Evidence unavailable state is explicit.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC09, AC11, AC28, AC31, AC32, AC37, AC38, AC40, AC44, AC45, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API decoded-image/ownership/size/deadline/idempotency tests; private-storage adapter failures and real PostgreSQL evidence metadata checks; browser optional upload, manual fallback and seller-only retrieval. Actual storage ACL evidence is separate.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Implementation and verification — 2026-10-24

- Image validation & metadata stripping in `backend/app/services/image_service.py`:
  - Enforced 5 MiB file size and 20 megapixel limit (`MAX_IMAGE_PIXELS = 20_000_000`).
  - Verified container headers and decoded raster payload (zlib decompressed IDAT validation for PNG, marker segment scan for JPEG).
  - Stripped non-critical metadata segments and chunks (EXIF, XMP, comments, text chunks).
- Evidence staging, storage, and lifecycle in `backend/app/services/evidence_service.py` & `evidence_store.py`:
  - `POST /api/public/orders/{token}/evidence`: Validates unsubmitted, unexpired order; enforces public access policy gate; enforces max 5 uploads per order (excessive image limit); rejects invalid MIME/Content-Type.
  - Generates 30-day retention deletion deadline (`delete_after = collected_at + 30 days`).
  - Durable failed upload tracking on storage outage without falsely claiming uploaded content exists.
  - Idempotent replay: retries with same mutation key return identical staged response; payload mismatch with same key returns 409 conflict.
  - Foreign evidence validation on order submission: rejects cross-order/cross-shop evidence references with 422 `FOREIGN_EVIDENCE_REFERENCE`.
  - Transitions evidence status from `staged` to `attached` upon valid order submission.
- Private seller retrieval in `backend/app/api/seller.py`:
  - `GET /api/seller/evidence/{id}`: Private short-lived retrieval restricted to owning seller and attached evidence.
  - Shop B cannot access Shop A evidence (404 Not Found, AC02).
  - Unsubmitted staged evidence remains inaccessible to sellers until submission.
  - Expired (> 30 days) or deleted evidence returns explicit 410 `EVIDENCE_EXPIRED` / `EVIDENCE_UNAVAILABLE`.
  - Sets `Cache-Control: private, no-store, max-age=0` and `X-Content-Type-Options: nosniff`.
- PostgreSQL persistence:
  - Added migration `backend/migrations/0012_order_evidence.sql` and SQLAlchemy entity `OrderEvidenceTable`.
- Frontend integration:
  - `EvidenceUploadField.tsx`: Client-side 5 MiB validation, loading spinner during upload, upload error display, removal from form, and manual submission fallback (AC09, AC45).
  - Integrated into `BuyerSubmissionForm.tsx`, passing attached `evidence_id` in `payment_claim`.
  - `EvidenceViewer.tsx`: Displays payment screenshot in `OrderDetailModal.tsx` for the active buyer revision, with explicit "No screenshot attached" and "Evidence unavailable (retained copy was deleted or expired)" states.
- Verification results:
  - Backend API: PASS, 227 tests (`npm run test:backend`).
  - Real PostgreSQL boundary: PASS, 3 tests (`tests/test_evidence_postgres.py`) with disposable loopback target `127.0.0.1:55447`.
  - Frontend React: PASS, 68 tests across 17 test files (`npm run test:frontend`).
  - Full root gate: `npm run check` with `BUYER_TEST_POSTGRES_URL` set to disposable target: PASS all 8 stages (`check-spN4qg/result.json`).
- Next action: Proceed with Ticket 14 (Use optional AI address suggestions) or Ticket 15 (Use optional AI screenshot extraction).

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.
