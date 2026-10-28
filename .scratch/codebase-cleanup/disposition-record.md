# Cleanup disposition record

Ticket: [01: Inventory and convention baseline](issues/01-inventory-and-convention-baseline.md)
Evidence date: 2026-10-28. Base revision: `7df3fa0` on `main`; checkout clean
(no tracked modifications, no non-ignored untracked files). No credential files
were read. The specification's earlier audit used `8c86f6b`; counts were rechecked
here rather than reused.

This record classifies candidates; it does not claim cleanup is complete. Ticket
02 executes scratch/artifact dispositions, ticket 03 re-verifies dead-code
candidates, tickets 04-08 organize by feature, ticket 09 prevents recurrence, and
ticket 10 verifies the integrated result.

**Execution update (2026-10-28):** ticket 02 moved the retained evidence to
`docs/verification/`, removed the temporary artifacts, and redirected the cleanup
runner. One localization screenshot showed a live account identifier and was
retained only in ignored `.evidence/`, not tracked. Paths below describe the audit
state at ticket 01; current locations and evidence are recorded in
[issue 02](issues/02-clean-scratch-and-artifact-producers.md).

## Evidence and counts

- Repository: 829 tracked files. Source areas: `backend/app` (115), `frontend/src`
  (225), `scripts` (9), `docs` (37), `tasks` (9), `.agents` (132), `.scratch` (143).
- Scratch: 143 tracked files = 101 Markdown work records + 42 non-Markdown
  artifacts (9 PNG, 9 log, 8 Python, 7 JSON, 5 CJS, 3 TSX, 1 HTML). This matches
  the specification's "131 tracked scratch files mixing records and artifacts"
  lead after later ticket records were added, but the artifact classification is
  from current content, not the earlier count.
- Tests: 101 backend `test_*.py` modules plus 5 support modules under
  `backend/tests`; 78 frontend `*.test.*` files; 3 tooling `scripts/*.test.mjs`.
- Migrations: 26 ordered SQL files (`0001`-`0026`), preserved as history.
- Methods: `git ls-files`, `git grep` for imports/routes/commands/docs, pytest and
  Vitest configuration, `node --test` discovery in `scripts/workspace.mjs`,
  physical line counts via `(Get-Content <file>).Count`, and targeted content
  inspection. No file was classified from age, author, extension, or path alone.

## Convention baseline

Authoritative for tickets 04-10 until ticket 09 restates it in maintained docs:

- **Source files** (application, tooling, styles; `backend/app`, `frontend/src`
  non-test, `scripts`): review at **250 physical lines**; **300 is the maximum**.
  Decompose by responsibility, never by compressed formatting. No blanket
  exclusions.
- **Tests** (`backend/tests`, `frontend/src/**/*.test.*`, `scripts/*.test.mjs`):
  same 250 review / 300 maximum. Narrow, documented exceptions are allowed only
  for cohesive scenarios or fixtures where splitting would duplicate shared
  setup or hide a single behavioral story. Record the reason, scope, and retained
  assertions in the owning ticket.
- **Documentation**: 250 physical lines is a review trigger, not a hard maximum.
  Split by topic when navigation or ownership suffers. Completed work records and
  historical task/design files remain truthful history; do not rewrite them just
  to meet a count. `docs/API_CONTRACTS.md` exceeds the trigger and is the main
  ticket 09 split candidate.
- **Migrations**: never split or edit history; size rules do not apply.
- Enforcement belongs to ticket 09. Until then, reviewers use this baseline.

### Source files at or above the 250-line trigger

Over the hard maximum (must split in the owning ticket):

| Lines | File | Owner |
| --- | --- | --- |
| 316 | `frontend/src/features/seller/OrderDetailModal.tsx` | 05 |
| 302 | `frontend/src/features/seller/ManualTransactionModal.tsx` | 06 |

At the review trigger (split only if mixed responsibilities; otherwise record the
cohesion evidence):

| Lines | File | Owner |
| --- | --- | --- |
| 299 | `frontend/src/features/locale/clerkLocalization.ts` | 08 |
| 294 | `frontend/src/features/seller/api.ts` | 05 (08 coordinates shared client) |
| 293 | `backend/app/services/order_service.py` | 04 (05 coordinates) |
| 292 | `backend/app/services/seller_service.py` | 05 |
| 284 | `backend/app/models/entities.py` | 05 (domain entities; 08 coordinates) |
| 270 | `frontend/src/features/seller/SellerWorkspace.tsx` | 05 |
| 262 | `frontend/src/features/buyer/BuyerSubmissionForm.tsx` | 04 |
| 258 | `backend/app/services/reconciliation_db.py` | 06 |
| 257 | `frontend/src/features/seller/TransactionCard.tsx` | 06 |
| 252 | `backend/app/services/reconciliation.py` | 06 |

### Tests over the 300-line maximum

These need a split or a documented cohesive exception; assertions and discovery
must be preserved either way.

| Lines | File | Owner |
| --- | --- | --- |
| 809 | `backend/tests/test_reconciliation.py` | 06 |
| 671 | `backend/tests/test_corrections_postgres.py` | 06 |
| 666 | `backend/tests/test_order_outcomes.py` | 06 |
| 495 | `backend/tests/test_courier_post_submission_changes.py` | 07 |
| 462 | `backend/tests/test_transaction_routes.py` | 06 |
| 423 | `backend/tests/test_order_routes.py` | 04/05 (serialize; one owner) |
| 407 | `backend/tests/test_payment_marker_protection.py` | 06 |
| 402 | `backend/tests/test_courier_submission_postgres.py` | 07 |
| 401 | `frontend/src/features/seller/SellerWorkspace.test.tsx` | 05 |
| 367 | `backend/tests/test_pathao_sandbox_booking.py` | 07 |
| 333 | `backend/tests/test_order_dates.py` | 05 |
| 332 | `backend/tests/test_link_encryption.py` | 08 |
| 325 | `frontend/src/features/seller/OrderDates.test.tsx` | 05 |
| 301 | `backend/tests/test_courier_submission_failures.py` | 07 |
| 301 | `frontend/src/features/seller/TransactionSearch.test.tsx` | 06 |

Review-trigger tests (250-300), owned by the same tickets: `test_payment_recovery_journey_postgres.py`
297, `test_durable_mode.py` 296, `test_courier_drafts.py` 278, `test_public_order_routes.py`
275, `CreateOrderModal.test.tsx` 268, `test_buyer_corrections.py` 266,
`TransactionDates.test.tsx` 262, `SellerSession.test.tsx` 259,
`test_courier_reconciliation_postgres.py` 255, `TransactionInbox.test.tsx` 255,
`CourierReview.test.tsx` 255, `test_order_search.py` 254, `test_clerk_auth.py` 253.

### Documentation over the 250-line review trigger

`docs/API_CONTRACTS.md` 493 (split candidate, ticket 09),
`tasks/bengali-english-localization-design.md` 460 (historical task record; keep),
`docs/tool-call-analysis-and-environment-optimization.md` 302 (review/split),
`docs/phase-1-readiness-plan.md` 272 and `docs/idea.md` 272 (review).
`docs/ARCHITECTURE.md` 109 sagged behind the code's module split; ticket 09
reconciles it. `AGENTS.md` 97 and `docs/agents/issue-tracker.md` 30 carry the
operational rules.

## Scratch candidates (143 files)

### Keep in scratch: Markdown work records (101 files)

Seven feature directories keep their specifications, issues, indexes, acceptance
notes, and contract annexes together. Completed work stays in place; do not
mass-archive it.

- `.scratch/agent-guardrails-and-test-resilience/` (4), `.scratch/bengali-english-localization/`
  (15), `.scratch/order-payment-search-date-filters/` (5), `.scratch/pathao-courier/`
  (17), `.scratch/phase-1-order-confirmation/` (24), `.scratch/phase-1-self-test/`
  (24), `.scratch/codebase-cleanup/` (12 at audit time; this record and the
  implementation handoff add two).
- Keep `ticket12-compaction-handoff.md`: it is a completed-work handoff/annex,
  referenced by issue 12, not execution output.
- Move the two verification reports out of scratch (below) and repair their
  links. Their results remain historical; relocation is not a rerun.

### Move to maintained verification storage (ticket 02)

Destination: `docs/verification/` (create), grouped by feature. Track it as
historical development evidence with a README explaining synthetic-data scope and
that these are not current readiness claims. Most inspected images contain
synthetic shop/order data; spot-check before tracking. The embedded-switch
screenshot was withheld from tracking because it showed a live account identifier
(see issue 02).

- 9 PNG: `.scratch/bengali-english-localization/verification/ticket12-embedded-switch.png`
  (withheld as sensitive), `ticket12-live-session.png`; `.scratch/pathao-courier/ticket07-cancelled-recovery.png`,
  `ticket07-noncreation.png`, `ticket12-buyer-pending.png`, `ticket12-desktop-modal-fixed.png`,
  `ticket12-phone-buyer.png`, `ticket12-phone-modal-fixed.png`, `ticket12-phone-seller-modal.png`.
- 2 Markdown reports: `.scratch/pathao-courier/ticket07-browser-verification.md`,
  `.scratch/pathao-courier/remote-migrations-verification.md`.
- 7 small check logs (`ticket12-check1.log` … `check6.log`, plus
  `check5-backend.log`/`check5-frontend.log`) and `.scratch/screenshot-removal-browser-result.json`.
  These are small, non-secret evidence of exact commands/results. Update their
  relative links after the move.
- Protected behavior: preserve the reported PASS/FAIL scope, including
  "mocked API", "synthetic", "sandbox not run", and date/revision context.

### Remove as temporary code (ticket 02)

No maintained file references these; they depend on machine-specific Playwright
paths, temporary preview mounts, or a completed one-time operation. Before
deletion, map any unique assertion to an existing maintained test or add a
focused component/API test where practical.

- 5 CJS browser probes: `.scratch/buyer-link-copy-browser.cjs`,
  `delivery-layout-browser.cjs`, `screenshot-removal-browser.cjs`,
  `spacing-browser.cjs`, `ui-revamp-browser.cjs`.
- 3 TSX previews: `.scratch/delivery-preview.tsx`, `spacing-preview.tsx`,
  `.scratch/pathao-courier/ticket07-browser.tsx`; and `ticket07-browser.html`.
- 4 phase-1 browser probes: `.scratch/phase-1-order-confirmation/{address,order_export,payment_extraction,structured_retention}_browser.py`.
- 3 courier probes: `.scratch/pathao-courier/test_ticket06_definitive_privacy_probe.py`,
  `test_ticket06_verification_probe.py`, `ticket11_inventory_probe.py`.
- 1 completed one-time purge script: `.scratch/purge-payment-screenshots.py`.
  ADR-0005 and migration `0026` retain the decision; do not keep a runnable
  destructive script loose in scratch.
- 2 large server logs: `.scratch/screenshot-api.stdout.log`,
  `.scratch/screenshot-api.stderr.log` (~0.9 MB combined; disposable).
- 6 JSON execution artifacts after summarizing outcomes in the moved reports:
  `.scratch/pathao-courier/remote-migrations-result.json`, `ticket11-inventory.json`,
  `ticket11-scoped-dry-run.json`, `ticket12-migrations-result.json`,
  `ticket12-schema-preflight.json`, `.scratch/screenshot-purge-result.json`.
  They contain a development database hostname and internal order/receipt IDs,
  not credentials. Do not newly track them; retain only safe outcomes/hashes.
- Keep `backend/tests/buyer_browser_demo.py`: it is an optional, offline-capable
  browser harness that already writes metadata to `.cache/`. After probe removal
  it has no caller, so document its invocation in the verification reference
  (ticket 09) or retain it with an explicit purpose. Evidence is insufficient to
  delete unique browser setup.

### Producers that recreate scratch clutter (ticket 02)

- `scripts/cleanup-phase1-orders.py` wrote its dry-run snapshot to
  `.scratch/pathao-courier/ticket11-scoped-dry-run.json` and its apply result next
  to it. Ticket 02 redirected both to `.cache/cleanup-phase1-orders/` (created
  before writing) and updated the issue-11 instructions; `py_compile`/Ruff pass.
  Do not run the script: it targets a live development database.
- `.scratch/purge-payment-screenshots.py` and `.scratch/screenshot-removal-browser.cjs`
  also wrote results into scratch; deleting them removes those producers.
- Existing maintained producers already use ignored storage: `scripts/checks.mjs`
  and `scripts/process.mjs` use `.cache/checks`, `scripts/smoke.py` uses `.cache`,
  `buyer_browser_demo.py` uses `.cache/buyer-browser.json`. No change needed.
- Local ignored clutter (`.cache/` ~100 ad-hoc run directories, `.pytest_cache/`,
  `.ruff_cache/`) is not tracked and does not dirty the checkout. Do not perform a
  bulk local purge as part of repository cleanup; no remote data cleanup is
  authorized.

## Non-scratch candidates

- **Keep (reachable):** `frontend/src/features/{demo,gemini,items}` render through
  `App.tsx`'s "Demo & tools" tab; backend chat/item routes, `services/gemini.py`,
  and `models/schemas.py` are reachable through that UI and smoke. `README.md`
  still describes them as demos. Ticket 03 must not delete them.
- **Keep (operational/referenced):** `scripts/cleanup-phase1-orders.py`,
  `backend/app/services/obsolete_cleanup.py`, `raw_evidence_cli.py` (documented in
  `docs/API_CONTRACTS.md` and `docs/retention-lifecycle.md`), all 26 migrations,
  and `backend/tests/*_postgres.py`.
- **Keep (history/evidence):** `docs/session-analysis/*` CSV/JSON referenced by
  analysis docs, `docs/phase-1-*`, `tasks/*`, `design-system/middle-man/MASTER.md`,
  and `.agents/skills` + `skills-lock.json`. These are records/config, not
  disposable output.
- **Investigate in ticket 03:** unused assets (`frontend/src/assets/{hero.png,react.svg,vite.svg}`,
  `frontend/public/icons.svg`), exports with no reachable caller, and stale
  architecture/contract statements. Static non-reference alone is insufficient;
  check build, runtime, docs, and tests first.
- **Ticket 09 doc split:** `docs/API_CONTRACTS.md` should become a short contract
  index plus domain annexes (order search/export, payments/reconciliation, Pathao
  settings, courier draft/review/reconciliation, buyer access/corrections,
  retention, demo boundaries). Do not change contract content while splitting.

## Test discovery and protected coverage baseline

- Backend: `uv run --locked pytest` from `backend`, `testpaths = ["tests"]`,
  `asyncio_mode = "auto"`, `pythonpath = ["."]`, warnings are errors. `conftest.py`
  clears provider variables, blocks non-loopback sockets, resets in-memory items,
  and provides `client`. PostgreSQL suites use the `postgres_buyer` fixture and
  skip when `BUYER_TEST_POSTGRES_URL` is unset (`backend/tests/buyer_postgres_support.py`);
  they cover transactions, contention, replay, and schema behavior.
- Frontend: `npm run test:frontend` → Vitest, happy-dom, `src/test/setup.ts`,
  globals, 5 s timeout. Feature-colocated rendered interaction and localization
  tests replace fetch explicitly.
- Tooling: `node --test scripts/*.test.mjs` covers check runner, context bounds,
  and process environment/log behavior.
- Full gate: `npm run check` runs tooling tests, backend lint/types/tests,
  frontend lint/tests/build, and HTTP smoke, writing a unique
  `.cache/checks/<run>/result.json`. Gates reject filters.
- Separate gates, not established by offline checks: PostgreSQL
  (`BUYER_TEST_POSTGRES_URL`), real browser/keyboard/physical-device checks,
  hosted/Clerk sessions, live Gemini, Pathao sandbox/live booking. Historical
  evidence in scratch is not a current run.

## Protected behavior to preserve per ticket

- 04: buyer-link authority, public projections, initial-submission deadline,
  revocation/reissue, retained input, corrections, seller-only/private fields,
  Bengali/English presentation, focus, no-repeat mutations.
- 05: navigation/history, onboarding/session states, order creation/details,
  buyer-link actions, form values, error recovery, API payloads.
- 06: seller-supplied evidence authority, shop/receiving-account isolation,
  payment single-use, deterministic matching, atomic/replay behavior, English CSV
  contracts, retired screenshot collection/private viewing.
- 07: one local draft per confirmation, seller review, parcel/location validation,
  server-derived remaining COD, stale-revision protection, uncertain-outcome
  blockers, reconciliation, no duplicate/premature bookings, no live booking.
- 08: seller authority, shop isolation, session-loss recovery, independent
  application secrets, buyer-link boundaries, offline standby, stable contracts,
  suppression comments reviewed against tooling.

## Downstream work bounds (recorded in each ticket)

- 02: scratch/evidence/tooling only. Split into 02a (records/evidence) and 02b
  (producers) if both cannot be completed and verified in one fresh context.
- 03: dead-code audit only; expected outcome may be "no deletion, evidence
  recorded". Do not fold feature organization into it.
- 04: buyer frontend + `order_service.py` review + buyer API/tests. One workflow
  cluster at a time (submission/correction/status).
- 05: seller shell/orders, split `OrderDetailModal.tsx`, seller tests, order
  API/domain review. Serialize with 04 on `order_service.py` and `test_order_routes.py`.
- 06: payments/reconciliation, split `ManualTransactionModal.tsx` and large
  payment tests, preserve PostgreSQL gates.
- 07: courier UI/API/domain, split large courier tests, preserve no-live-booking
  rule.
- 08: auth/shared infrastructure after 04-07; `clerkLocalization.ts` review,
  session/security tests.
- 09: doc reconciliation/split, size-convention enforcement, scratch/artifact
  prevention. Do not replace tooling stacks.
- 10: integrated acceptance A1-A8 and honest gate report.

## Uncertainties and next action

- Exact minimal assertion set that makes each removable probe redundant is not yet
  proven; ticket 02 must map it before deleting, and may add a focused maintained
  test. If a probe's browser-only behavior has no high-level seam, retain the
  evidence and report the gap rather than claiming coverage.
- Whether the small check logs/JSON belong in tracked verification storage or
  should be summarized into Markdown is a ticket 02 sensitivity/navigation call.
  Default: move small non-secret evidence, summarize sensitive target metadata.
- `buyer_browser_demo.py` has no test caller; retain and document until ticket 09
  decides whether it is a maintained browser seam.
- No code or tooling checks were required for this record. Documentation edits made
  with it change only convention wording; the final root check runs after those
  edits and its result is recorded in ticket 01.

Next action: compact the context, then execute ticket 02 from
`implementation-handoff.md`; do not start feature reorganization before scratch
and producers are clean.
