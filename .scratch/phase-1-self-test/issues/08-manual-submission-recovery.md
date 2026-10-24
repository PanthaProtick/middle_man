# 08: Submit once and recover an uncertain response

**What to build:** Complete manual buyer submission, recover uncertain outcomes with the original mutation key and continue viewing submitted-order status.

**Blocked by:** 06: Disable AI while preserving manual entry; 07: Open a buyer link with a safe public projection.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A valid manual submission supports different contact/sender numbers and commits once; invalid input or same-key changed payload cannot partially write.
- [ ] Controlled-time tests enforce the original 48-hour initial deadline, including a draft opened earlier; submitted pending orders remain pending and viewable afterward.
- [ ] A lost response is resolved with the original key/refetch; duplicate/new submissions and buyer corrections are rejected while legitimate original-operation replay returns the durable outcome.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Buyer submission API/service, mutation-key handling, submission form and status/retry hooks.

## Verification target

Focused API boundary/idempotency tests, PostgreSQL commit/retry evidence and buyer retry/status feature tests; keep original validation assertions.

Coverage: AC05, AC07–AC09, AC28, AC31–AC33, AC37–AC38. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

AI activation, screenshots, token rotation and payment-match policy changes.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
