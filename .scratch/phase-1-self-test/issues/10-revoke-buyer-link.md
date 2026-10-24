# 10: Revoke buyer-link access

**What to build:** Let the owning seller revoke a buyer link through the workspace without cancelling the order.

**Blocked by:** 08: Submit once and recover an uncertain response.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Owning-shop revocation is durable, audited, version-checked and idempotent; foreign sellers cannot invoke it.
- [ ] Revocation denies public reads, writes and cached replay while preserving seller access, order lifecycle, terms and payment allocation.
- [ ] A PostgreSQL submission/revocation race produces one serialized outcome; public authorization does not rely on stale state.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Order access state, typed seller action, public authorization/replay checks and seller order controls.

## Verification target

Feature action/error tests plus API access/replay/isolation cases and one independent-actor PostgreSQL race with restart verification.

Coverage: AC02, AC28, AC37–AC38, AC48 plus revocation cases. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Generating replacement tokens and changing order cancellation semantics.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
