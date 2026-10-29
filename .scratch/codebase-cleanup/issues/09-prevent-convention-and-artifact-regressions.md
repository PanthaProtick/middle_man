# 09: Prevent convention and artifact regressions

**Status:** implemented — conventions and documentation verified

**What to build:** Practical convention enforcement and accurate maintenance instructions that keep the cleaned repository organized during ordinary development.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding; 08 — Organize authentication and shared infrastructure.

- [x] Reconcile the baseline and completed-ticket exceptions against the resulting structure; document authoritative source/test size rules and ownership conventions consistently.
- [x] Correct stale architecture/setup claims against owning code, without turning historical acceptance evidence into current-readiness claims.
- [x] Add low-cost checks for agreed structural/convention rules where useful, using existing tooling boundaries and narrow explained exceptions rather than blanket exclusions.
- [x] Verify scratch contains permitted work records and affected producers cannot normally regenerate tracked scratch clutter; preserve legitimate completed records and annexes.
- [x] Preserve strict typing, meaningful lint rules, root wrappers, offline behavior, and existing cache/lockfile handling. Do not replace formatter/tooling stacks as housekeeping.
- [x] For changed tooling behavior, cover success and relevant failure cases through existing command/filesystem seams; avoid tests that merely mirror implementation.
- [x] Validate active navigation links and maintained commands; verify safe producer paths without remote mutation or destructive operations.
- [x] Run focused tooling and affected application checks followed by final root `npm run check`; record enforcement scope, exceptions, and limitations for final acceptance.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Restate the authoritative 250 review / 300 maximum source rule, test exceptions,
  and documentation review trigger in maintained docs; remove any remaining
  conflicting wording.
- Split `docs/API_CONTRACTS.md` 493 into an index plus domain annexes without
  changing contract content; review `docs/tool-call-analysis-and-environment-optimization.md`
  302, `docs/phase-1-readiness-plan.md` 272, and `docs/idea.md` 272. Keep
  `tasks/bengali-english-localization-design.md` 460 as historical record.
- Reconcile `docs/ARCHITECTURE.md` (109) with the current route/service modules;
  do not turn historical acceptance evidence into current-readiness claims.
- Update `docs/agents/issue-tracker.md` so scratch is for Markdown records,
  indexes, acceptance notes, and contract annexes only; point execution output and
  reusable evidence to `.cache/` and `docs/verification/`.
- Add a low-cost convention check where useful (e.g. tracked scratch non-Markdown
  guard and/or source/test size scan) with narrow explained exceptions. Do not
  replace tooling stacks or add file-count-only tests.
- Document or retire the now-uncalled `backend/tests/buyer_browser_demo.py`
  purpose from ticket 02 evidence.

**Required checks:** tooling tests for any changed command behavior, doc link
checks, frontend/backend affected checks, then `npm run check`.

## Final execution record — 2026-10-29

Base revision `6c4e182`. No application behavior, API payload, migration, or
dependency-lockfile change. Document and tooling edits only.

### Convention authority and enforcement

- Added `docs/CONVENTIONS.md` as the authoritative source for the 250 review /
  300 maximum source rule, narrow documented test exceptions, the 250-line
  documentation review trigger, ownership boundaries, and work-record storage.
- `AGENTS.md`, `docs/README.md`, and `docs/ARCHITECTURE.md` now link to it. Root
  `AGENTS.md` keeps only the operational summary. No maintained doc now conflicts
  on size; remaining 250/300 mentions are historical work records or intentionally
  historical task records.
- Added `scripts/conventions.mjs` and `scripts/conventions.test.mjs`; root
  `npm run conventions` exposes the check and `npm run check` runs it as the
  **Repository conventions** stage. It checks:
  - tracked `.scratch/` files are Markdown (Git `ls-files` seam);
  - source/test files over 300 physical lines, with test-only exceptions carrying
    a reason (`sizeExceptions` is empty today);
  - relative links in `README.md`, `AGENTS.md`, `docs/**/*.md`, and `tasks/**/*.md`;
  - `npm run <script>` references against root `package.json`.
- Files at 250-299 lines are reported as review triggers, not failures. The check
  does not fetch external URLs, inspect `.scratch` history, prove cohesion, or
  exercise application/browser behavior.
- Tooling tests cover clean and failing command paths, scratch artifacts, size
  review/maximum/exception cases, broken links, and unknown commands.

### Documentation reconciliation

- Split `docs/API_CONTRACTS.md` (493) into a 47-line index plus six domain annexes
  under `docs/contracts/`: application conventions, orders/search/export, payments
  and reconciliation, Pathao/courier, buyer access/corrections, and retention/AI/
  retired surfaces. Script comparison against the base file found zero missing
  contract lines beyond the old title/note/separator; the only semantic correction
  is the application-conventions statement that all models live in
  `models/schemas.py`, which now matches the route/service/model split.
- Rewrote `docs/ARCHITECTURE.md` against the current `backend/app/api/*` routers,
  workflow service groups, split models, core seams, frontend feature slices, and
  offline/durable boundaries. Preserved the seller evidence and Pathao connection
  invariants, including correction-history and raw-SMS retention behavior.
- Marked `docs/phase-1-readiness-plan.md` and `docs/phase-1-self-test.md` as
  historical plans, corrected the removed `evidence_store.py` reference and
  screenshot-era setup claims, and linked the current retention/contract sources.
  Updated `docs/retention-lifecycle.md` to remove retired screenshot/object-storage
  claims and describe current database raw/structured retention.
- Reviewed the over-trigger documents: `docs/tool-call-analysis-and-environment-optimization.md`
  (302, historical session analysis; kept, corrected its scratch-path advice),
  `docs/phase-1-readiness-plan.md` (historical plan; corrected as above), and
  `docs/idea.md` (272, already marked historical; kept). Kept
  `tasks/bengali-english-localization-design.md` (460) as history.
- Updated `docs/agents/issue-tracker.md` to reserve scratch for Markdown work
  records, direct disposable output to ignored `.cache/` and reusable evidence to
  `docs/verification/`, and point commands at `AGENTS.md` rather than duplicate the
  list. Updated `docs/agents/verification.md` to the nine-stage gate.
- Retained `backend/tests/buyer_browser_demo.py` as an optional, manually invoked
  offline browser harness with its `.cache/buyer-browser.json` metadata; the
  verification reference now states it is not a CI gate or live-readiness claim.

### Scratch and producers

- `git ls-files .scratch` contains 101 Markdown work records and zero non-Markdown
  files. Completed records and annexes were not moved or rewritten for counts.
- `scripts/cleanup-phase1-orders.py` writes reports under
  `.cache/cleanup-phase1-orders/`; `buyer_browser_demo.py` writes
  `.cache/buyer-browser.json`; check/smoke runners keep their existing `.cache/`
  paths. A scoped search found no producer writing into `.scratch/`.
- No operational cleanup, remote mutation, database action, or provider call was
  executed.

### Verification

- `npm run test:tooling` — **PASS**, 23 tests.
- `npm run conventions` — **PASS**, 844 tracked files; 22 at the 250-line review
  trigger; no failures or size exceptions.
- `npm run lint` — **PASS** (Ruff and Oxlint).
- `npm run typecheck` — **PASS** (115 backend source files; frontend `tsc --noEmit`).
- Final root `npm run check` — **PASS**, result
  `.cache/checks/check-JWwNsh/result.json`, all nine stages. Backend 493 passed /
  175 skipped (PostgreSQL URL unset); frontend 81 files / 439 tests passed; build
  and HTTP smoke passed. The fresh gate ran after the review fixes and ticket
  record update.
- Not run: browser, physical-device, hosted/Clerk, live Gemini, Pathao sandbox/live,
  and PostgreSQL-integration gates. Historical evidence remains historical.

### Limits and exceptions

- No source/test size exception is currently needed; `sizeExceptions` is empty.
- Documentation over 250 lines is a review trigger, not enforced as a failure.
- The link/command checker covers maintained docs only; historical `.scratch`
  records and external URLs are intentionally outside its scope.
- Historical plans and verification records remain historical; annotations do not
  turn them into current acceptance evidence.
