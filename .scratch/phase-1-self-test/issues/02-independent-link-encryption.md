# 02: Separate saved-link encryption from Clerk credentials

**What to build:** Create, retrieve and recover saved buyer links using a stable application encryption key independent of seller authentication credentials.

**Blocked by:** 01: Fail explicitly when durable storage is unavailable.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] An order link created with the application key remains recoverable after Clerk credential changes and application restart.
- [ ] Missing or incompatible encryption keys fail explicitly in integration mode, without a fixed fallback or disclosure of key material.
- [ ] Existing encrypted records are inspected before changing key sources; preserve their recoverability or require an explicit verified compatibility step, never reset data silently.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Token encryption, order-link creation/retrieval, application configuration and saved-link persistence tests.

## Verification target

Round-trip through order creation/retrieval, restart and changed-Clerk-key cases; include wrong/missing application key and existing-record compatibility failure.

Coverage: AC04, AC39, plus independent-encryption regressions. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Payment-marker keys, online rotation infrastructure and buyer access policy.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
