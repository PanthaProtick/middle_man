# 01: Establish cleanup inventory and convention baseline

**Status:** completed - inventory and baseline recorded; implementation cleanup not started

**What to build:** A reviewable cleanup map and consistent convention baseline that let a maintainer distinguish disposable artifacts from maintained behavior and execute each subsequent slice within one fresh context window.

**Blocked by:** None (can start immediately).

- [x] Recheck checkout status and base revision; protect unrelated tracked and untracked work and avoid credential files.
- [x] Inventory application code, tests, tooling, documentation, generated artifacts, and relevant untracked clutter before inspecting leaf components.
- [x] Record each candidate's purpose, references or entry points, keep/move/remove/investigate decision, intended owner or destination, protected behavior, and required checks. Static non-reference, age, authorship, and size alone are insufficient deletion evidence.
- [x] Record existing test discovery and meaningful coverage, distinguishing offline checks, optional PostgreSQL checks, and browser/live-provider evidence.
- [x] Reconcile documentation around 250 physical lines as a review trigger and 300 as the source maximum; apply the same review discipline to tests with narrow documented cohesive-scenario/fixture exceptions.
- [x] Bound each later ticket to concrete responsibilities and acceptance targets in its work record. If a slice cannot fit one fresh context window, propose a split before starting it; do not silently expand its scope.
- [x] Preserve existing architecture and domain decisions, API contracts, migration history, meaningful assertions, and product behavior. No feature retirement or remote data cleanup is authorized.
- [x] Verify changed documentation references; if code or tooling changes, run appropriate focused checks and final root `npm run check`. Record actual results and unrun gates.
- [x] Record the candidate map and next action without claiming implementation cleanup is complete.

## Work record

**Baseline:** `7df3fa0` on `main`, clean checkout. Nothing unrelated was edited;
no credential/env files were read. The full disposition map is
[disposition-record.md](../disposition-record.md); the resumable execution plan is
[implementation-handoff.md](../implementation-handoff.md).

**Decisions**

- Scratch keeps 101 Markdown work records; 42 non-Markdown artifacts split into
  17 evidence files to move (9 PNG, 7 small logs, 1 JSON), 25 temporary
  code/output files to remove, and 2 verification Markdown reports to relocate.
- `scripts/cleanup-phase1-orders.py` is the one maintained producer still writing
  into scratch; ticket 02 redirects its reports to `.cache/cleanup-phase1-orders/`.
- Reachable demo features and historical records stay. No feature retirement,
  migration edit, remote purge, or provider action is authorized.
- Convention baseline: source/tests review at 250 physical lines and max at 300,
  with narrow documented test exceptions; documentation reviews at 250 and splits
  by topic. Reconciled in `AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/README.md`.
- Current oversized set matches the specification lead: 17 code/test files over
  300 (2 source, 15 tests), plus 10 source files at the 250-300 review trigger.

**Changed paths:** `.scratch/codebase-cleanup/disposition-record.md`,
`.scratch/codebase-cleanup/implementation-handoff.md`, this ticket, downstream
ticket work records, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/README.md`, and
`ticket-index.md`.

**Checks:** `npm run check` on 2026-10-28 **PASS** at
`.cache/checks/check-MSLI1t/result.json`: tooling tests, backend lint/types/tests,
frontend lint/tests/build, and HTTP smoke all passed. Backend: 493 passed, 175
skipped (optional PostgreSQL suites; `BUYER_TEST_POSTGRES_URL` unset). Frontend:
78 files / 439 tests passed. Relative-link check over every changed Markdown file:
all links resolve. Real-browser/device, hosted Clerk, live Gemini, Pathao sandbox,
and PostgreSQL acceptance were **NOT RUN**; smoke is not browser proof.

**Next action:** After context compaction, execute ticket 02 from the handoff.
Do not start ticket 03+ until scratch and its producers are clean.
