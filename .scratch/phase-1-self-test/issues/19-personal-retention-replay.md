# 19: Delete eligible personal records without releasing payments

**What to build:** Remove eligible completed personal records while retaining unresolved dependencies and minimal consumed-payment protection.

**Blocked by:** 15: Verify durable receipt-to-confirmation behavior; 18: Run raw-evidence cleanup with safe retries.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Controlled-time tests enforce 12 calendar months for completed records and preserve structured evidence needed by unresolved orders.
- [ ] Personal-data deletion leaves minimal replay markers: the consumed TrxID cannot be resubmitted/reimported into a reusable receipt.
- [ ] Failures/retries report accurate partial/overdue outcomes, and no test claims purge from backups or solves deferred real-data account-deletion policy.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing structured retention, unresolved-order dependencies, marker binding and seller retention reporting.

## Verification target

Execute existing PostgreSQL structured-retention/used-marker tests and add boundary/dependency regressions only where needed; verify status through the existing seller surface.

Coverage: AC41–AC43. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

New real-data account/shop deletion policy and permanent retention of unnecessary personal fields.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
