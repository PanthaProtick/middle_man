# 06: Import payment SMS with manual fallback

**What to build:** A seller pastes single or bulk incoming-payment SMS for a selected account, sees each result and completes unsupported records through manual entry.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** needs-info — implementation verified locally; permissioned SMS-format acceptance remains open

## Acceptance criteria

- [x] Accept bounded batches (initially 50 messages/64 KiB) for an owning-shop account; deterministic supported-format parsing yields explicit provider/TrxID/amount/sender/time fields.
- [x] Show per-item unsupported, missing, masked, ambiguous and conflicting results. Successful items remain durable in mixed batches; never guess sender digits, payment time or receiving destination.
- [x] Send successful observations through existing identity/deduplication and reconciliation, supporting both arrival orders and replay after raw SMS deletion.
- [x] Never invoke Gemini for SMS. Provide a visible path to the existing manual receipt form; pasted buyer screenshots are not seller receipt evidence.
- [x] Privately associate raw SMS with its owner, collection time and 30-day deletion deadline on ingestion; re-import/reprocess does not extend an existing raw object's deadline or copy raw text into permanent audit/logs.
- [ ] Support idempotent batch retries, seller-only inbox/result views and bounded explicit failures. Record which sanitized permissioned formats are tested; unsupported Nagad/bKash formats remain failures rather than broad provider-support claims.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC13, AC14, AC15, AC16, AC17, AC18, AC21, AC37, AC39, AC40, AC49, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API mixed-batch/duplicate/conflict/parser tests with zero outbound AI calls; real PostgreSQL receipt/import durability; frontend per-item errors and browser paste-to-confirm/manual fallback. Representative live-format acceptance remains a separate gate.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.


## Implementation evidence — 2026-10-24

Implemented bounded typed SMS ingestion and paginated private result history, separate
raw-evidence ownership/original-deadline records, atomic PostgreSQL receipt/result
writes, shared identity/reconciliation, and integrated React import/manual fallback.
All observations in a batch precede reconciliation, so contradictory messages cannot
confirm based on item order. Idempotency is shop-scoped and persisted with the batch.
Missing/masked/ambiguous/provider-mismatch/unsupported outcomes never guess evidence.
Raw text is absent from result history, audit and validation responses; SQL bind
parameters are hidden in application debug logs. Raw deletion never renews a deadline.

Changed paths: `backend/app/api/sms.py`, `backend/app/models/sms*.py`,
`backend/app/services/sms_import.py`, `sms_parser.py`, `reconciliation_queries.py`,
shared transaction/reconciliation services, private validation handling in `main.py`,
SQL migration `0007_sms_import.sql`, SMS API/PostgreSQL tests, synthetic browser harness,
and seller `SmsImportPanel`, typed API client, workspace/manual-form integration.
See `docs/sms-import.md` for the precise format and retention boundary.

Verification:
- PASS `npm run typecheck` (regular focused iterations).
- PASS `npm run test:backend -- tests/test_sms_import.py tests/test_sms_postgres.py`
  (14 cases, including real PostgreSQL).
- PASS `npm run test:backend -- tests/test_reconciliation_postgres.py tests/test_sms_postgres.py`
  (allocation/COD regression and both arrival orders).
- PASS `npm run test:frontend -- src/features/seller/SmsImportPanel.test.tsx`
  (2 tests; per-item output/manual account, loading, failure/retry key behavior).
- PASS final `npm run check`: `.cache/checks/check-87pnYy/result.json`, all eight
  stages; 112 backend tests, 44 frontend tests. Disposable PostgreSQL enabled at
  loopback port 55439, fresh generated schemas per test. No application credentials.
- Earlier full-check failures exposed an unflushed allocation causing null immediate
  buyer COD, then a test lint issue; both fixed before the final passing run.
- PASS real PostgreSQL concurrent batch retry, durable history, raw deletion/replay,
  both receipt/claim arrival orders, and same-batch conflicts in both message orders.
- PASS actual browser: synthetic buyer claim, mixed SMS paste-to-confirm, actual COD
  on both views, unsupported/masked results, manual fallback, durable history reload,
  network failure retaining pasted input and successful retry after server restart.
  Screenshot: `.cache/sms-browser-confirmation.png` (synthetic records only).
- PASS separate Standards and Spec reviews after fixing their findings: moved
  allocation queries behind reconciliation helper; deferred allocation until all
  batch observations are present. No outstanding actionable review findings.
- NOT RUN live identity/payment-provider/deployment/production migrations.
- NOT RUN permissioned live-format acceptance: no samples supplied. Only the explicitly
  synthetic, timezone-qualified grammar in `docs/sms-import.md` is implemented.
  This is not general bKash/Nagad support; hence the relevant criterion stays open.
- NOT RUN automatic raw cleanup (ticket 18), hosted storage purge/backups/rate-limit
  acceptance. Deadline metadata and manual deletion simulation do not prove cleanup.

Next action: obtain sanitized, permissioned incoming SMS examples, document their
provider/time/destination semantics, add strict parsers/regression cases, then clear
live-format acceptance. Keep cleanup and other shared launch gates closed until their
own evidence exists. No deployment or shared database migration was performed.
