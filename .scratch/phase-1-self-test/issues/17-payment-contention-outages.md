# 17: Verify payment contention and outage boundaries

**What to build:** Prove independent database actors cannot double-consume a receipt or invent success during uncertain commits and competing seller actions.

**Blocked by:** 16: Verify conflict and correction recovery.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Concurrent manual/automatic allocation and known competing claims allow at most one durable consumption; the losing outcome is explicit.
- [ ] Cancellation/correction races with matching serialize to a valid result without stale acceptance; tests cover independent actors rather than one-session mocks.
- [ ] Outage/restart near commit produces an all-or-nothing durable result resolvable with the original mutation key; no memory-only confirmation.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing independent-session PostgreSQL fixtures, shop-first locking, allocation transaction and same-key recovery.

## Verification target

Execute focused existing concurrency/outage tests with independent sessions on a disposable database; report executed counts, skips and exact evidence. Repair only reproduced failures.

Coverage: AC20, AC22–AC23, AC37–AC39. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

New lock granularity, throughput optimization and application-wide recovery redesign.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
