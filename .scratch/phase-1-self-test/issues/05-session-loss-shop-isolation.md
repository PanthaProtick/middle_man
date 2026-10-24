# 05: Handle session loss and reject foreign-shop access

**What to build:** Keep private seller state inaccessible after session loss and isolate every private operation between the two test identities.

**Blocked by:** 04: Sign in and open the owning shop.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Sign-out, expiry and identity changes clear or invalidate private UI state; late responses from an earlier session cannot repopulate it.
- [ ] Two identities cannot read or mutate each other's accounts, orders, receipts, histories, corrections, decisions, evidence, exports or retention operations; responses do not leak existence.
- [ ] Verifier failures preserve the unauthorized/unavailable distinction and present a recoverable state without stale private content.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Shared seller request/session lifecycle and existing private-route permission tests; inspect surfaces in bounded groups.

## Verification target

Use a compact data-driven permission matrix with existing fixtures and feature tests for sign-out/expiry/late responses; record actual two-identity isolation observations.

Coverage: AC01, AC02, AC28, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Rewriting already-correct private services; newly introduced endpoints must also carry their own isolation tests in their owning tickets.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
