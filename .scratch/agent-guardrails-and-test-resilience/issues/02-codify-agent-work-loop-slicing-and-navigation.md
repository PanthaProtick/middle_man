# 02: Codify Agent Work Loop Slicing and Context Navigation Guardrails

**What to build:** Update repository agent instructions to mandate cluster-based slicing for multi-screen or cross-cutting tasks, requiring focused test verification after each cluster before advancing. Establish navigation discipline by mandating bounded line-range reads and prohibiting redundant consecutive file reads in a single turn, preventing exploration bloat and context exhaustion.

**Blocked by:** None (can start immediately)

**Status:** complete

- [x] Agent instructions require broad visual or architectural changes to be decomposed into bounded feature clusters.
- [x] Agent instructions require running focused test commands after each feature cluster before modifying subsequent files.
- [x] Navigation instructions mandate bounded line-range queries for large files and prohibit consecutive redundant reads of identical files in a single turn.
- [x] Agent instructions remain strictly below the repository line-count invariant.
