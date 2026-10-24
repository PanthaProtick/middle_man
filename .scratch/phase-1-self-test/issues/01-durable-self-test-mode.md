# 01: Fail explicitly when durable storage is unavailable

**What to build:** Run an explicit self-test integration mode that requires durable persistence and reports database failures instead of succeeding in memory.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Missing, placeholder or invalid database configuration and engine/schema initialization failure block durable self-test operations with explicit diagnostics.
- [ ] A runtime outage returns a typed failure or resolves an already committed same-key result; it never switches to memory.
- [ ] Explicit offline development remains functional and cannot be confused with integration readiness; diagnostics contain no credentials.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Configuration, application startup, database dependency and one existing seller mutation with its error UI.

## Verification target

Use startup/configuration cases and one route-level write/outage regression; exercise adapter queries and restart on a disposable database. Record target validation and schema inventory.

Coverage: AC39, AC50. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Authentication, secret migration, public access and a general rewrite of database services.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
