# 11: Reissue a link for the same order

**What to build:** Recover buyer access with a fresh link for the same order while permanently invalidating previous links.

**Blocked by:** 10: Revoke buyer-link access.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Reissue preserves order identity, commercial terms, allocation, original deadline and submission state; it cannot revive expired/cancelled/replaced orders or reopen submission.
- [ ] The old token fails all public operations and the new token has only the remaining valid authority; token/access state survives restart.
- [ ] Audit, stale-version rejection and same-key retries are atomic; retries do not rotate twice and older cached responses cannot reactivate superseded tokens. Cover concurrent reissue/revocation.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Order token/access state, seller reissue action, saved-link response and existing audit/idempotency conventions.

## Verification target

Feature link-copy/action tests, API preservation/replay tests and narrowly scoped PostgreSQL token-change races.

Coverage: AC04, AC31–AC38 plus reissue cases. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Order replacement, payment migration, deadline extension and online encryption-key rotation.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
