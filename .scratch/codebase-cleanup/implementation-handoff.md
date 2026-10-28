# Implementation handoff - after ticket 01

**Executed in part: ticket 02 completed the scratch/artifact slice on 2026-10-28.**
See [ticket 02](issues/02-clean-scratch-and-artifact-producers.md) for final
dispositions, moved/deleted paths, and check results. The instructions below are
retained as the planning record; do not re-run the moves or deletions.

**Disposable planning aid.** Ticket 01 is complete; implementation cleanup starts
at ticket 02. Read this file plus
[ticket 02](issues/02-clean-scratch-and-artifact-producers.md) and
[disposition-record.md](disposition-record.md), then work ticket by ticket. Do not
re-run the whole audit or re-read every record; verify only the assumptions a
ticket touches. Update the owning ticket, not this file, as work completes.

## Baseline

- Ticket 01 commit contains this handoff; confirm with `git log -1 --oneline`.
  Repository convention is one ticket per commit on `main`.
- Inventory baseline: 143 tracked scratch files (101 Markdown records + 42
  artifacts), 101 backend test modules, 78 frontend test files, 3 tooling suites,
  26 migrations, 829 tracked files.
- Convention: source/tests review at 250 physical lines, 300 maximum; narrow
  documented test exceptions only. Documentation reviews at 250 and splits by
  topic. Migrations and completed records are history.
- Use physical line counts: `(Get-Content <file>).Count`, not
  `Measure-Object -Line` (it ignores blank lines).
- Never read `.env`, `backend/.env`, `frontend/.env*`, or credential files. Never
  run remote purges, provider calls, or live migrations. No feature retirement.

## Ticket 02: scratch and artifact producers

Goal: scratch holds only Markdown work records; useful evidence is discoverable
under docs; removed temporary code is justified; the remaining scratch writer is
redirected. Split into **02a (records/evidence)** and **02b (artifacts/producer)**
if the whole slice cannot be verified in one fresh context.

### 02a - create evidence storage and move records

1. Create `docs/verification/README.md` stating: historical development evidence,
   synthetic/mock scope, dates, what each run did and did not establish, and that
   it is not current production/browser/live readiness. Link it from
   `docs/README.md`.
2. Create `docs/verification/pathao-courier/`,
   `docs/verification/localization/`, and
   `docs/verification/payment-screenshot-removal/`.
3. `git mv` the 19 evidence files:
   - Pathao/courier (same directory preserves the report's relative image links):
     `.scratch/pathao-courier/ticket07-browser-verification.md`,
     `remote-migrations-verification.md`, `ticket07-cancelled-recovery.png`,
     `ticket07-noncreation.png`, `ticket12-buyer-pending.png`,
     `ticket12-desktop-modal-fixed.png`, `ticket12-phone-buyer.png`,
     `ticket12-phone-modal-fixed.png`, `ticket12-phone-seller-modal.png`, and
     `ticket12-check1.log` through `ticket12-check6.log`
     (`check5-backend.log`/`check5-frontend.log` are part of that range).
   - Localization: `.scratch/bengali-english-localization/verification/ticket12-live-session.png`
     to `docs/verification/localization/`; the companion
     `ticket12-embedded-switch.png` showed a live account identifier and was
     moved to ignored `.evidence/verification/localization/` instead of tracked.
   - Payment screenshot removal:
     `.scratch/screenshot-removal-browser-result.json`.
4. Spot-check every moved image for real names/numbers before tracking. The
   courier images were synthetic; the embedded-switch localization image exposed
   an account identifier and was withheld from tracking as noted above.
5. Update links (depths matter):
   - `.scratch/bengali-english-localization/issues/12-*.md` →
     `../../../docs/verification/localization/<file>` from the issue directory.
   - `.scratch/pathao-courier/issues/12-*.md` → three levels up to the repo root,
     then `docs/verification/pathao-courier/<file>`.
   - `.scratch/pathao-courier/ticket12-compaction-handoff.md` → two levels up.
   - `.scratch/pathao-courier/ticket07-browser-verification.md` (now moved): keep
     same-directory image links; replace its "copy the fixture and run Vite"
     reproduction paragraph with a truthful note that the disposable fixture was
     removed, so the record is historical and was not rerun.
   - `.scratch/pathao-courier/remote-migrations-verification.md`: replace the
     `remote-migrations-result.json` pointer with a note that the scratch execution
     report was disposable and removed; keep safe outcome/hashes that matter.
   - `.scratch/pathao-courier/issues/11-*.md`: update the
     `../ticket11-scoped-dry-run.json`/`../ticket11-inventory.json` pointers to say
     the execution reports were disposable and removed, and that the script now
     writes to `.cache/cleanup-phase1-orders/`.
6. `rg -n "ticket07-browser-verification|remote-migrations-verification|ticket12-|ticket11-|verification/" .scratch docs README.md AGENTS.md`
   and confirm no stale links.

### 02b - remove temporary artifacts and redirect the producer

1. Delete the 25 temporary artifacts. Before each group, map its unique assertion
   to maintained coverage or record why no maintained seam exists:
   - Browser probes → `BuyerLinkCopy.test.tsx`, `BuyerAiPolicy.test.tsx`,
     `test_payment_screenshot_removal.py`, courier component/API suites. Spacing
     and layout probes are visual-only: no Playwright dependency exists, so record
     the limitation instead of adding a toolchain.
   - Courier probes → `test_courier_submission.py` (stale/cross-shop/zero COD) and
     `test_courier_submission_failures.py` (malformed/privacy/unknown).
   - Phase-1 probes → address/order-export/payment/retention API suites.
   - `purge-payment-screenshots.py` → ADR-0005 + migration `0026` +
     `test_payment_screenshot_removal.py`.
   - Large server logs and JSON target reports → outcomes preserved; do not track
     hostnames or internal IDs.
2. Delete: 5 CJS (`buyer-link-copy`, `delivery-layout`, `screenshot-removal`,
   `spacing`, `ui-revamp`), 3 TSX (`delivery-preview`, `spacing-preview`,
   `ticket07-browser`) + `ticket07-browser.html`, 8 Python (4 phase-1 probes, 2
   ticket-06 probes, `ticket11_inventory_probe.py`, `purge-payment-screenshots.py`),
   2 `screenshot-api.*.log`, and 6 JSON (`remote-migrations-result`,
   `ticket11-inventory`, `ticket11-scoped-dry-run`, `ticket12-migrations-result`,
   `ticket12-schema-preflight`, `screenshot-purge-result`).
3. Edit `scripts/cleanup-phase1-orders.py`:
   - `REPORT = ROOT / '.cache/cleanup-phase1-orders/report.json'`;
   - create the parent directory before the first write;
   - write the apply result beside it;
   - keep target/snapshot/dry-run guards unchanged. Do **not** run it.
4. Verify:
   - `git status --short` shows only intended moves/deletes/edits.
   - `git ls-files .scratch | Where-Object { $_ -notlike '*.md' }` → empty.
   - `backend/.venv/Scripts/python.exe -m py_compile scripts/cleanup-phase1-orders.py`
     (or `uv run --locked python -m py_compile ../scripts/cleanup-phase1-orders.py`
     from `backend`).
   - `npm run lint:backend` (Ruff covers `scripts/`).
   - `npm run test:tooling`.
   - `npm run check` (eight stages; record the `.cache/checks/<run>/result.json`).
   - Report browser/PostgreSQL/live gates separately; moving evidence does not
     rerun them.
5. Update ticket 02 with dispositions, moved/deleted paths, mappings, checks,
   result path, and remaining uncertainty; commit.

## Ticket 03: dead-code audit

Expected outcome may be **no deletion**. Keep reachable demos (`features/demo`,
`gemini`, `items`; chat/item routes; `services/gemini.py`), operational tools,
migrations, and historical docs. Investigate unused assets/exports and stale doc
claims with `git grep`, the build, and tests. Never classify from non-reference
alone. Record evidence and run `npm run check`; commit.

## Tickets 04-08: organization order

Serial execution is the default. Shared files require one owner:

| Ticket | Scope | Mandatory split / review |
| --- | --- | --- |
| 04 | buyer UI/API/domain/tests; `order_service.py` 293; `test_order_routes.py` 423 shared with 05 | `BuyerSubmissionForm.tsx` 262 review |
| 05 | seller shell/orders; order API/domain; `models/entities.py` 284; `seller/api.ts` 294 | `OrderDetailModal.tsx` 316 **split**; `SellerWorkspace.test.tsx` 401, `OrderDates.test.tsx` 325, `test_order_dates.py` 333 |
| 06 | payments/reconciliation | `ManualTransactionModal.tsx` 302 **split**; `test_reconciliation.py` 809, `test_corrections_postgres.py` 671, `test_order_outcomes.py` 666, `test_transaction_routes.py` 462, `test_payment_marker_protection.py` 407 |
| 07 | courier/Pathao; no live booking | `test_courier_post_submission_changes.py` 495, `test_courier_submission_postgres.py` 402, `test_pathao_sandbox_booking.py` 367 |
| 08 | auth/shared; do not invent generic modules | `clerkLocalization.ts` 299 review; `test_link_encryption.py` 332, `SellerSession.test.tsx` 259 |

Workflow: trace current callers/contracts/tests, change one bounded workflow, run
focused frontend/backend tests, then move to the next. Split by responsibility
(e.g. OrderDetailModal inspection sections vs dialog state), not line count.
Test exception wording must include file, lines, cohesive scenario/fixture reason,
why splitting would harm shared setup, retained assertions, and verified
collection. Never delete a unique boundary/failure/security/replay/concurrency
case. Commit per ticket with the root check result.

## Ticket 09: prevention and conventions

- Split `docs/API_CONTRACTS.md` (493) into a short index + domain annexes without
  changing contracts; review docs at 302/272/272; keep the 460-line historical
  task file unchanged. Reconcile `docs/ARCHITECTURE.md` with current modules.
- Make `docs/agents/issue-tracker.md` explicit: scratch = Markdown records/indexes/
  acceptance notes/contract annexes; execution output → `.cache/`; historical
  evidence → `docs/verification/`.
- Add low-cost checks where useful: tracked scratch contains only Markdown; source
  files ≤300 with a narrow exception list; tests >300 require documented
  exceptions. Extend `scripts/*.test.mjs` for command/filesystem behavior. Avoid
  file-count-only tests and blanket exclusions.
- Decide whether `backend/tests/buyer_browser_demo.py` is a maintained browser
  seam; document its invocation or retire it with evidence.

## Ticket 10: final verification

Reconcile baseline vs final: 101 records retained, 42 artifacts resolved (19 moved,
25 removed minus the overlap already counted as records; use actual git counts),
2 source files split, 10 review-trigger source files justified, 15 oversized tests
split or excepted. Verify links, producer paths, and changed API/domain behavior
with existing high-level checks. Run a fresh `npm run check` and report the result
artifact plus FAIL/SKIP/BLOCKED/NOT RUN gates explicitly.

## Known pitfalls

- PowerShell 5.1: no `Join-String`; use `ForEach-Object`/`-join`; comma-separate
  file lists instead of bash braces.
- `git ls-files` prints forward slashes even on Windows.
- Old ticket files contain mojibake (`�?"`); do not mass-rewrite unrelated text.
- `.cache/` already holds ~100 ad-hoc run dirs. It is ignored; do not bulk-delete
  it as part of repository cleanup, and do not commit it.
- The pre-commit hook runs `npm run check`. If it fails, fix the cause; do not use
  `--no-verify`.
- `scripts/cleanup-phase1-orders.py` targets a live development database and has
  a destructive `--apply`; only compile/lint it during cleanup.
- Moving evidence must not upgrade its claims. Keep "mocked API", "synthetic",
  "sandbox NOT RUN", and historical dates intact.

## Next action

After compaction: `git status --short`, read ticket 02, then execute **02a**. If
02a completes, continue into 02b only if the context window still has room;
otherwise stop after committing 02a and record the exact next step in ticket 02.
