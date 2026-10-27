# 03: Enforce Background Task Reactive Wakeup and Zero-Polling Rules

**What to build:** Formalize execution guardrails in agent instructions prohibiting background task status polling and banning interim user-facing progress messages while async verification tasks run. Ensure agents yield turns, await automatic system wakeup events, and deliver consolidated results upon completion.

**Blocked by:** 02: Codify Agent Work Loop Slicing and Context Navigation Guardrails

**Status:** complete

- [x] Agent instructions explicitly prohibit polling background task statuses with management tools.
- [x] Agent instructions explicitly ban sending intermediate progress text to the user while background test or verification processes are active.
- [x] Instructions mandate yielding the turn and waiting for the harness reactive task completion event before delivering final summaries.
- [x] Root workspace verification check passes cleanly across all project quality gates.

## Comments

- Updated `AGENTS.md` "Execution and orchestration guardrails": background test and
  verification runs must yield and wait for their completion event, with status
  polling (`manage_task`, `manage_subagents`) and sleep timers forbidden, and no
  interim progress messages before one final report.
- Verification: `npm run check` PASS — tooling, backend lint/types/tests, frontend
  lint/test/build, HTTP smoke. Result:
  `.cache/checks/check-sQQciq/result.json`.
