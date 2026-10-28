# 09: Prevent convention and artifact regressions

**Status:** ready-for-agent

**What to build:** Practical convention enforcement and accurate maintenance instructions that keep the cleaned repository organized during ordinary development.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding; 08 — Organize authentication and shared infrastructure.

- [ ] Reconcile the baseline and completed-ticket exceptions against the resulting structure; document authoritative source/test size rules and ownership conventions consistently.
- [ ] Correct stale architecture/setup claims against owning code, without turning historical acceptance evidence into current-readiness claims.
- [ ] Add low-cost checks for agreed structural/convention rules where useful, using existing tooling boundaries and narrow explained exceptions rather than blanket exclusions.
- [ ] Verify scratch contains permitted work records and affected producers cannot normally regenerate tracked scratch clutter; preserve legitimate completed records and annexes.
- [ ] Preserve strict typing, meaningful lint rules, root wrappers, offline behavior, and existing cache/lockfile handling. Do not replace formatter/tooling stacks as housekeeping.
- [ ] For changed tooling behavior, cover success and relevant failure cases through existing command/filesystem seams; avoid tests that merely mirror implementation.
- [ ] Validate active navigation links and maintained commands; verify safe producer paths without remote mutation or destructive operations.
- [ ] Run focused tooling and affected application checks followed by final root `npm run check`; record enforcement scope, exceptions, and limitations for final acceptance.

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

