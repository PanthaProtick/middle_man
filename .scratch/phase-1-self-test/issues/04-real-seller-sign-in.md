# 04: Sign in and open the owning shop

**What to build:** Sign in through Clerk and open a workspace whose shop ownership comes from the verified session.

**Blocked by:** 01: Fail explicitly when durable storage is unavailable.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] The integration path obtains a real session token and uses verified identity to create/read only its owning shop; no default mock token grants access.
- [ ] Verification checks signature, expiry, trusted issuer and applicable audience/authorized-party constraints; key discovery uses trusted configuration and handles key refresh.
- [ ] Invalid credentials yield typed 401 responses and unavailable verification yields an explicit 503 without private data; offline tests inject a bounded verifier seam.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Seller application entry, token acquisition, shared backend identity verification and shop setup/read contracts.

## Verification target

Add API-level signed-token and trusted-key refresh tests plus a feature sign-in/workspace test. Record one real Clerk-session shop journey separately from offline checks.

Coverage: AC01, initial AC02, AC50. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Full cross-surface permission matrix, session-loss UI hardening and public buyer access.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
