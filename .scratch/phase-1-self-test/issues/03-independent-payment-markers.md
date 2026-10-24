# 03: Separate payment-marker protection from Clerk credentials

**What to build:** Keep consumed-payment protection stable when Clerk credentials change, using a dedicated payment-identity secret.

**Blocked by:** 01: Fail explicitly when durable storage is unavailable.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Payment markers created under the dedicated secret still reject reuse after Clerk credential changes and restart.
- [ ] Missing or mismatched marker secrets fail closed; historical markers are never ignored or silently regenerated.
- [ ] Existing marker bindings and historical identities are checked before changing key sources; unsupported migration is blocked explicitly.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Payment digest computation, marker-key binding, retained receipt identities and allocation/replay tests.

## Verification target

Use an actual PostgreSQL consumed-payment replay before/after credential changes, wrong-key rejection and a historical-marker compatibility case.

Coverage: AC17, AC42, plus independent-marker regressions. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Link encryption, automatic key rotation and changes to matching criteria.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
