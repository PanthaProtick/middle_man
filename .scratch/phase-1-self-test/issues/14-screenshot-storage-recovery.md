# 14: Recover from screenshot storage failures

**What to build:** Give clear recoverable outcomes when local evidence writes, reads or associated database commits fail.

**Blocked by:** 13: Persist and privately retrieve screenshots.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Filesystem read/write/delete exceptions map to typed application outcomes without fabricated success or private path disclosure.
- [ ] Partial writes and rollback after file creation are safely cleaned or recorded for repeatable orphan recovery; no attachment points to an uncommitted success.
- [ ] Retry behavior preserves original mutation semantics and does not duplicate attachments or delete another order's file.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Filesystem adapter exception mapping, evidence mutation transaction boundary and upload/viewer failure UI.

## Verification target

Inject adapter I/O faults and database failure after file creation; assert durable metadata/file outcomes and user retry states, not internal helper calls.

Coverage: AC11, AC37–AC39, storage portion of AC43. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Retention scheduling and unrelated transaction refactors.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
