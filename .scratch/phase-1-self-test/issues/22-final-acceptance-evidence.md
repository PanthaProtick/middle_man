# 22: Reconcile acceptance evidence and verify the final candidate

**What to build:** Produce an honest final self-test acceptance record backed by executed local, database and browser evidence.

**Blocked by:** 17: Verify payment contention and outage boundaries; 19: Delete eligible personal records without releasing payments; 21: Record browser recovery and seller utilities.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Map every AC01–AC50 and added link/key/mode case to dated evidence or a precise deferred portion; no applicable skipped/failed case is counted as passed.
- [ ] Verify required PostgreSQL cases actually executed and browser evidence matches the final candidate; code changes after observations trigger only the necessary rechecks.
- [ ] Run the final root verification gate and record exact result/log paths, revision and known limitations; claim only local synthetic self-test passed when all required evidence succeeds.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Approved self-test acceptance matrix, completed ticket evidence and root verification reports.

## Verification target

Reconcile evidence first, execute final root checks, then inspect concise summaries/failure tails. Reopen the owning ticket for fixes rather than turning this ticket into an omnibus implementation task.

Coverage: Final reconciliation of AC01–AC50 and all added self-test cases. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

AI/hosted/pilot readiness claims, new features and hiding outstanding work behind completed labels.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
