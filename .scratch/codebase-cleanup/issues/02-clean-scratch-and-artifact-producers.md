# 02: Clean scratch storage and fix artifact producers

**Status:** implemented — scratch/evidence/tooling verified

**What to build:** Scratch storage containing only past/current work records, with useful executable checks and evidence discoverable in maintained locations and routine runs no longer recreating clutter.

**Blocked by:** 01 — Establish cleanup inventory and convention baseline.

- [x] Follow the approved inventory dispositions, recording evidence for each removal and destination for each retained artifact.
- [x] Preserve specs, issues, completed tickets, indexes, Markdown acceptance notes, and contract annexes together; do not erase implementation history.
- [x] Move reusable checks into existing owned test locations, operational tools into maintained scripts, and useful historical development evidence into documentation verification storage.
- [x] Retain uncertain candidates in appropriate non-scratch locations with their investigation notes. Inspect evidence sensitivity before tracking it elsewhere; do not expose private data.
- [x] Remove proven disposable output; direct future temporary logs, reports, previews, and run data into ignored cache storage. Update producers, commands, imports, and active links together.
- [x] Preserve unique probe coverage through maintained tests where practical, including discovery and fixture behavior. Historical results remain historical, with truthful context after relocation.
- [x] Do not execute operational purges, remote mutations, or provider actions to prove a script move. Use safe existing test/dry-run boundaries and report limitations.
- [x] Verify scratch contents and affected links, test discovery, and safe producer output paths. Run focused backend/frontend/tooling checks as relevant, then final root `npm run check`.
- [x] Record final dispositions, results, exceptions, and remaining uncertainty for downstream tickets.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Keep all 101 Markdown work records in place, including
  `pathao-courier/ticket12-compaction-handoff.md`.
- Move to a new `docs/verification/`: 9 PNG screenshots (2 localization, 7
  Pathao/courier), 7 small `ticket12-check*.log` files, and
  `screenshot-removal-browser-result.json`; move and update links for
  `ticket07-browser-verification.md` and `remote-migrations-verification.md`.
- Remove 25 temporary artifacts: 5 CJS probes, 3 TSX previews + 1 HTML harness,
  8 Python probes/one-time scripts, 2 large server logs, and 6 JSON reports that
  contain development-database hostnames or internal IDs. Summarize safe outcomes
  in the moved reports first; never track the target metadata.
- Redirect `scripts/cleanup-phase1-orders.py` reports from
  `.scratch/pathao-courier/` to `.cache/cleanup-phase1-orders/`, create the
  directory before writing, and update the ticket-11 instructions. Do not run it.
- Retain `backend/tests/buyer_browser_demo.py`; it has no caller after probe
  removal but is unique offline browser setup. Record its invocation for ticket 09.

**Split before starting if needed:** 02a = records/evidence relocation and link
repair; 02b = artifact removal plus producer path change. Do not mix these with
feature organization.

**Required checks:** `rg` for every moved/removed path in active records, docs,
and scripts; `python -m py_compile scripts/cleanup-phase1-orders.py`; backend Ruff
on `scripts`; `npm run test:tooling`; final `npm run check`. Browser/PostgreSQL/
live-provider gates stay NOT RUN unless actually executed safely.

## Final execution record — 2026-10-28

Base revision `5c3d78e` on `main`. Work was done as 02a (records/evidence) then
02b (artifact removal and producer), without touching feature organization.

### 02a — evidence destinations (19 files)

| Evidence | Destination |
| --- | --- |
| 8 PNG screenshots (courier plus localization live session) | `docs/verification/pathao-courier/`, `docs/verification/localization/` |
| 1 sensitive localization PNG (embedded switch) | ignored `.evidence/verification/localization/`; not tracked |
| 7 `ticket12-check*.log` files | `docs/verification/pathao-courier/` |
| `screenshot-removal-browser-result.json` | `docs/verification/payment-screenshot-removal/` |
| `ticket07-browser-verification.md`, `remote-migrations-verification.md` | `docs/verification/pathao-courier/` |

- `docs/verification/README.md` states the historical/synthetic boundaries and
  is linked from `docs/README.md`. It does not upgrade any prior PASS.
- Sensitivity exception: `ticket12-embedded-switch.png` showed a live account
  identifier in the Clerk recovery surface. It was removed from tracking and
  remains only in ignored `.evidence/verification/localization/`; issue 12 records
  that fact. The identifier still exists in earlier Git history (the file was
  tracked at the base commit), so this limits future exposure but does not rewrite
  history. The other eight images were inspected; they show synthetic shop/order
  data.
- `ticket07-browser-verification.md` now says its disposable fixture was removed
  and the record was not rerun. Its image links still resolve in the new directory.
- `remote-migrations-verification.md` replaces the removed JSON pointer with the
  safe PASS outcome and the two migration source SHA-256 values. No hostname or
  internal identifier is tracked.
- Pathao issue 07/12, the ticket 12 handoff, localization issue 12, and the
  payment-removal task now point at the moved evidence or say the execution report
  was disposed. Phase-1 issue records whose probes were removed now name the
  maintained suites instead of presenting the probes as runnable launchers.
- `scripts/cleanup-phase1-orders.py` now writes
  `.cache/cleanup-phase1-orders/report.json`, creates that directory before the
  dry-run write (and before the apply result), and writes
  `ticket11-cleanup-result.json` beside it. Issue 11 instructions were updated.
  The runner was **not executed**; it targets a live development database.

### 02b — removed artifacts (25) and coverage mapping

Per-artifact mapping for the probe/preview group:

- `buyer-link-copy-browser.cjs` → `BuyerLinkCopy.test.tsx`.
- `screenshot-removal-browser.cjs` → `BuyerAiPolicy.test.tsx` and
  `test_payment_screenshot_removal.py`.
- `delivery-layout-browser.cjs`, `spacing-browser.cjs`, `ui-revamp-browser.cjs`,
  `delivery-preview.tsx`, `spacing-preview.tsx`, and `ticket07-browser.tsx` +
  `ticket07-browser.html` → component/interaction behavior is in the courier and
  buyer suites; the visual layout/spacing/overflow observations are visual-only
  with no maintained Playwright equivalent. That coverage gap is recorded rather
  than adding a browser toolchain.
- 4 phase-1 probes (`address`, `order_export`, `payment_extraction`,
  `structured_retention`): maintained coverage is `test_address_routes.py`,
  `test_order_export.py`, payment-screenshot-removal/retention suites, and the
  structured-retention backend tests.
- 2 courier probes: privacy/malformed/unknown cases are permanent tests in
  `test_courier_submission_failures.py`; stale/cross-shop/zero-COD cases are in
  `test_courier_submission.py` and its PostgreSQL variants.
- `ticket11_inventory_probe.py`: its read-only safe counts remain in issue 11; a
  live-database inventory probe is intentionally not part of the maintained suite.
- `purge-payment-screenshots.py`: ADR-0005, migration `0026`, and
  `test_payment_screenshot_removal.py` retain the decision and protected behavior.
- 2 large `screenshot-api.*.log` files: disposable server output, no assertions.
- 6 JSON reports containing development-database hostnames or internal IDs:
  removed after safe outcomes were summarized in the moved reports/issues. No
  target metadata was newly tracked.

### Verification

- `git ls-files .scratch` → 101 Markdown records, zero non-Markdown files.
- Markdown link check over all touched docs/records → all relative links resolve.
- `git grep` for the moved/removed paths → only historical inventory/planning
  records and notes that mark the artifact as removed remain; no active link or
  runnable instruction.
- `python -m py_compile scripts/cleanup-phase1-orders.py` → PASS.
- `npm run lint:backend` (Ruff, includes `scripts/`) → PASS.
- `npm run test:tooling` → 16 passed, 0 failed.
- Focused backend: `test_payment_screenshot_removal.py`,
  `test_courier_submission_failures.py`, `test_order_export.py`,
  `test_address_routes.py` → 38 passed.
- Focused frontend: `BuyerAiPolicy.test.tsx`, `BuyerLinkCopy.test.tsx`,
  `OrderExport.test.tsx` → 3 files, 11 tests passed.
- Final root `npm run check` → PASS, `.cache/checks/check-GbN2HS/result.json`;
  all eight stages. Backend 493 passed/175 skipped (PostgreSQL URL unset),
  frontend 439 passed in 78 files, tooling 16 passed, build and HTTP smoke passed.

### Review corrections

- Two-axis review initially found misattributed purge evidence, a 0024/0025
  citation pointing at the 0022/0023 record, a circular issue-11 comparator, and
  an under-specified per-artifact mapping. The purge record now leaves the
  historical body intact and appends a post-cleanup note; issue 12 records the
  0024/0025 hashes/counts; issue 11 marks the removed-probe comparison as
  historical; and the removal mapping names each probe. The embedded-switch
  history caveat and the moved-record index description were corrected too.

### Limits and remaining uncertainty

- No browser, PostgreSQL, Clerk, Gemini, Pathao sandbox/live, migration, cleanup,
  or provider action was executed for this ticket. The moved browser/migration
  records are historical, not reruns.
- `backend/tests/buyer_browser_demo.py` was retained. Its invocation and resume
  behavior are now documented in `docs/agents/verification.md`; ticket 09 decides
  whether it remains a maintained browser seam.
- The withheld embedded-switch screenshot is only in local ignored storage. If
  that local copy is lost, the remaining tracked evidence is the live-session
  screenshot and the written PASS/FAIL record; no account identifier is exposed.
- Visual spacing/layout probes have no maintained automated equivalent. That is a
  known coverage gap, not a passing browser gate.
- The cleanup runner's report path was compile/lint-verified and inspected, not
  executed; a live dry run remains an operational action for the owner.

