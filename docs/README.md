# Project Documentation (Tier 2 Context)

This directory houses **deep, on-demand reference documentation**. 

[Session context investigation](session-context-investigation.md) measures repository-linked Codex and Antigravity sessions against a preferred 100k-token context budget, with per-call and per-response evidence. Read it when investigating agent context usage or environment optimization.

### For AI Coding Agents:
* Do **NOT** load every document in this directory into your initial context prompt.
* Read specific files only when working on a relevant domain:
  * [`ARCHITECTURE.md`](ARCHITECTURE.md): System topology, data flow, feature colocation.
  * [`API_CONTRACTS.md`](API_CONTRACTS.md): REST guidelines, Pydantic schemas, and frontend API syncing.
  * [`agents/environment.md`](agents/environment.md): Setup, dependency/cache failures, and Antigravity discovery problems.
  * [`agents/verification.md`](agents/verification.md): Failed checks, stage logs, and browser/live acceptance boundaries.
* When adding significant new architectural subsystems (e.g., Auth, Payments, Background Workers), create dedicated modular documents in this directory rather than appending to [`AGENTS.md`](../AGENTS.md).
