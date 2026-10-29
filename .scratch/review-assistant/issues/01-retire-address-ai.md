# 01: Retire address AI and erase historical AI copies

**What to build:** Buyers enter their delivery address without address AI controls,
consent prompts, or extraction requests. Historical AI copies disappear while
buyer-confirmed delivery details and order/payment history remain usable.

**Blocked by:** None (can start immediately).

**Status:** implemented

**Implementation difficulty:** 4/5 — High.

**Why:** The visible control is small, but retirement spans cached public responses,
forward migrations, runtime schema readiness, raw/structured retention, maintenance
tools, and historical test fixtures. Incomplete removal can break unrelated cleanup
or erase confirmed addresses instead of AI copies.

**Agent fit:** Strong persistence and compatibility reasoning; comfortable tracing
all consumers before deleting a store. Not a UI-only cleanup assignment.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [x] Remove buyer address AI UI, consent flow, extraction client behavior, public
  extraction route, extraction-only provider/models, and obsolete availability
  signal. Old clients cannot still invoke address parsing; configured credentials
  do not restore it.
- [x] Preserve manual written-address entry and buyer-confirmed structured address
  fields. This slice does not yet make Pathao selections mandatory.
- [x] Retire address-specific configuration and dependencies only; preserve shared
  Gemini settings needed by later review assistance.
- [x] Add a forward migration that erases all historical extraction requests,
  responses, generated suggestions, and extraction replay results. Trace where
  each copy lives rather than assuming deletion of raw text is sufficient.
- [x] Preserve submitted address revisions, payment claims, receipts, allocations,
  lifecycle, and duplicate-payment protection. Do not rewrite historical migrations.
- [x] Update schema readiness, raw/structured retention, maintenance consumers,
  public response/replay projections, and seller retention presentation so none
  requires the retired extraction store or advertises obsolete AI counts.
- [x] Seed pre-migration AI records and confirmed address/payment data; prove the
  former are gone and the latter survive. Remaining cleanup/retention operations
  work after migration; repeated supported cleanup is safe.
- [x] HTTP and rendered tests prove address AI is absent, manual submissions and
  retries still work, and retired extraction access makes zero provider calls.
- [x] Keep current maintained contracts truthful about retirement; preserve older
  records as history with explicit supersession where necessary.
- [x] Run focused retirement/migration/retention/public-order tests and final root
  `npm run check`; record results and distinguish local from hosted acceptance.

## Notes

Do not replace extraction with a hidden provider call or move generated suggestions
into submitted-address storage. Private backups and provider-held historical copies
are outside what an application migration can prove deleted.

## Implementation record (2026-10-30)

Decisions:

- Deleted the extraction subsystem outright (public route/handler, provider, service,
  request/response models, SQLAlchemy table, and its tests) instead of disabling it.
- `PublicOrder.ai_assistance_available` and `Settings.ai_assistance_available` were
  removed; shared `GEMINI_API_KEY`, `GEMINI_MODEL` and `ai_enabled` remain for later
  review assistance.
- Extraction replay lived in `address_extractions.result_json`, not the shared
  idempotency store, so dropping the table erases raw requests, provider responses,
  generated suggestions and replay results together. A defensive delete of legacy
  `operation='address_extraction'` rows is included.
- Migration `0027_retire_address_ai.sql` also strips `ai_assistance_available` from
  cached `buyer_submission.response_json`; it is guarded by a `LIKE` pre-filter and
  re-application is safe.
- Retention is SMS-only; generic `evidence_cleanups` operational history is preserved.
- `BuyerAiPolicy.test.tsx` was replaced by `BuyerAddressAiRetirement.test.tsx` so the
  filename matches the behavior it proves.

Changed paths:

- Backend: `app/api/public_orders.py`, `app/models/buyer.py`, `app/core/config.py`,
  `app/core/database.py`, `app/services/raw_evidence_status.py`,
  `app/services/raw_evidence_cleanup.py`, `app/services/structured_retention_db.py`,
  `app/services/structured_retention_memory.py`; deleted
  `app/models/address_assistance.py`, `app/models/address_entities.py`,
  `app/services/address_assistance.py`, `app/services/address_provider.py`;
  `scripts/cleanup-phase1-orders.py`.
- Migration: `backend/migrations/0027_retire_address_ai.sql`.
- Backend tests: new `test_address_ai_retirement.py`,
  `test_address_ai_migration_postgres.py`; updated `test_ai_policy.py`,
  `test_public_access_policy.py`, `test_smoke_environment.py`,
  `test_link_revocation.py`, `test_link_reissue.py`, `test_raw_evidence_status.py`,
  `test_raw_evidence_cleanup.py`, `test_durable_postgres.py`; deleted
  `test_address_routes.py`, `test_address_adapter.py`, `test_address_postgres.py`.
- Frontend: deleted `AddressAssistance.tsx`, its two tests,
  `locale/addressAssistanceCopy.ts`, `BuyerAiPolicy.test.tsx`; updated
  `BuyerSubmissionForm.tsx`, `buyer/types.ts`, `buyerMessages.ts`,
  `seller/types.ts`, `EvidenceRetentionPanel.tsx`, `historyCopy.ts`,
  `copyAudit.test.ts`, `DemoTools.tsx`, buyer/retention fixtures and tests; new
  `BuyerAddressAiRetirement.test.tsx`.
- Docs: `contracts/buyer-access-and-corrections.md`,
  `contracts/retention-ai-and-retired-surfaces.md`, `retention-lifecycle.md`,
  `ARCHITECTURE.md`, `API_CONTRACTS.md`, `adr/0007-...md` (status),
  `adr/0005-...md` (partial-supersession note).

Check results:

- Focused backend: 57 passed.
- Focused frontend: 6 files, 66 passed.
- `npm run typecheck`: passed (backend 111 files; frontend clean).
- PostgreSQL (disposable loopback DB `middleman_retire_ai_test`, PostgreSQL 18.4):
  `test_address_ai_migration_postgres.py`, `test_durable_postgres.py`,
  `test_structured_retention_postgres.py`, `test_obsolete_cleanup_postgres.py` ->
  19 passed. Proves seeded extraction rows/replays are erased by 0027 applied twice,
  confirmed revisions/orders/receipts/allocations/markers are unchanged, the used
  payment still blocks a new order, and repeat cleanup stays clean.
- Root `npm run check`: PASS (`.cache/checks/check-5UjlqS/result.json`) — tooling,
  conventions, backend lint/types/tests, frontend lint/tests/build, HTTP smoke.
  PostgreSQL tests are skipped in that gate without `BUYER_TEST_POSTGRES_URL`.

Unresolved risks:

- Local tests and HTTP smoke do not prove hosted, browser, or live-provider behavior;
  those were not run and are not claimed. Provider-held copies and backups remain
  outside what migration 0027 can prove deleted.
- Pathao selections are still optional, per this slice.

Next action: none for this ticket; ticket 02 (seller review assistant) remains the
follow-on slice.

