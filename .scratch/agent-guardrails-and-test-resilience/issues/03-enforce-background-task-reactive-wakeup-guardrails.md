# 03: Enforce Background Task Reactive Wakeup and Zero-Polling Rules

**What to build:** Formalize execution guardrails in agent instructions prohibiting background task status polling and banning interim user-facing progress messages while async verification tasks run. Ensure agents yield turns, await automatic system wakeup events, and deliver consolidated results upon completion.

**Blocked by:** 02: Codify Agent Work Loop Slicing and Context Navigation Guardrails

**Status:** ready-for-agent

- [ ] Agent instructions explicitly prohibit polling background task statuses with management tools.
- [ ] Agent instructions explicitly ban sending intermediate progress text to the user while background test or verification processes are active.
- [ ] Instructions mandate yielding the turn and waiting for the harness reactive task completion event before delivering final summaries.
- [ ] Root workspace verification check passes cleanly across all project quality gates.
