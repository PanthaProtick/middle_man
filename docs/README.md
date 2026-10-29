# Project Documentation (Tier 2 Context)

This directory houses **deep, on-demand reference documentation**. Review a
documentation file at 250 physical lines and split it by topic when navigation
suffers; historical task records and completed work notes remain unchanged.
Source/test size, ownership, and work-storage rules are in
[`CONVENTIONS.md`](CONVENTIONS.md).

[Codex ticket tool-call analysis](codex-ticket-tool-call-analysis.md) ranks tool output, command duration, failures and review costs across all six locally discoverable Codex ticket chats and twelve reviewers, with audit data and environment benchmark priorities.

[Session context investigation](session-context-investigation.md) measures repository-linked Codex and Antigravity sessions against a preferred 100k-token context budget, with per-call and per-response evidence. Read it when investigating agent context usage or environment optimization.

[Tool call analysis & environment optimization](tool-call-analysis-and-environment-optimization.md) provides an empirical analysis of 1,599 tool calls across all 21 Antigravity ticket implementation sessions (Tickets 01–05, 11), identifying execution latency, command bottlenecks, shell spawn overhead, and concrete optimizations.

### For AI Coding Agents:
* Do **NOT** load every document in this directory into your initial context prompt.
* Read specific files only when working on a relevant domain:
  * [`ARCHITECTURE.md`](ARCHITECTURE.md): System topology, data flow, feature colocation.
  * [`CONVENTIONS.md`](CONVENTIONS.md): Source/test size, ownership, work-record storage, and enforcement.
  * [`API_CONTRACTS.md`](API_CONTRACTS.md): Contract index, with domain annexes under [`contracts/`](contracts/application-conventions.md).
  * [`agents/environment.md`](agents/environment.md): Setup, dependency/cache failures, and Antigravity discovery problems.
  * [`agents/verification.md`](agents/verification.md): Failed checks, stage logs, and browser/live acceptance boundaries.
  * [`verification/README.md`](verification/README.md): Historical browser, migration, and command evidence moved from scratch; not current readiness claims.
* When adding significant new architectural subsystems (e.g., Auth, Payments, Background Workers), create dedicated modular documents in this directory rather than appending to [`AGENTS.md`](../AGENTS.md).
