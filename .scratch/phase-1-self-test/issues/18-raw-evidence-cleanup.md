# 18: Run raw-evidence cleanup with safe retries

**What to build:** Run repeatable local cleanup that deletes due raw evidence and makes failed deletion visible and safely retryable.

**Blocked by:** 14: Recover from screenshot storage failures.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A documented local invocation processes the original 30-day deadlines for applicable raw images/SMS/AI records; edits/reimports do not reset deadlines.
- [ ] Storage failure leaves the item pending/overdue instead of falsely deleted; retry completes only after removal succeeds and preserves structured state.
- [ ] Controlled-time evidence covers boundary timing, an I/O outage and recovery; external backup/provider copies remain explicitly unproven.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing raw cleanup/status services, durable file adapter, controlled clock and seller retention view.

## Verification target

Use actual local files with injected controlled time/failure, existing raw-retention API/status tests and a feature overdue/retry presentation test.

Coverage: AC17, AC40, AC43. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Hosted scheduling/alerts, cloud purge certification and completed personal-record deletion.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
