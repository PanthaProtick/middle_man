# 16: Verify conflict and correction recovery

**What to build:** Resolve synthetic conflicts and corrections through existing seller review paths without losing audit history or duplicating payment allocation.

**Blocked by:** 15: Verify durable receipt-to-confirmation behavior.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Competing claims and contradictory records remain held for review; seller decisions/corrections retrigger only eligible matching and preserve immutable revisions.
- [ ] Manual exceptions require owning authority, receipt, reason and valid amount/COD preview; over-total payments and confirmed commercial-term edits stay rejected.
- [ ] Cancellation/rejection and post-confirmation observations preserve the accepted allocation and payment protection; stale versions and changed-payload retries cannot overwrite outcomes.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing evidence resolution, pending/confirmed delivery corrections, receipt corrections, exception preview and lifecycle decisions.

## Verification target

Use the existing bounded scenario fixtures for conflict resolution, correction, exception and cancellation; retain assertions and add regressions only for observed failures.

Coverage: AC19–AC21, AC24–AC30, AC34–AC35, AC38. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

New matching rules, refunds, courier side effects or broad service rewrites. If a failure spans multiple domain owners, record it and split the fix before expanding scope.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
