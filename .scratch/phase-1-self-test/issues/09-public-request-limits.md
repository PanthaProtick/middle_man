# 09: Bound public request admission

**What to build:** Reject oversized or excessive public traffic predictably before buffering large bodies or doing expensive order/storage work.

**Blocked by:** 07: Open a buyer link with a safe public projection.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Explicit configurable body/request/upload limits cover valid and invalid tokens; oversized bodies are rejected before whole-body buffering, including requests without a trustworthy content length.
- [ ] Request-rate rejection has clear retry semantics, bounded limiter state and no private/token leakage; the local scope is documented rather than advertised as distributed protection.
- [ ] Existing valid manual requests and allowed image sizes continue to work with readable rejection states.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Shared public request admission, upload ingress, typed errors and client retry/error presentation.

## Verification target

Use API tests for oversized streamed requests, invalid-token traffic, throttling/recovery and ordinary valid requests; feature-test relevant error rendering.

Coverage: Ingress portion of AC11, error portion of AC45. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Hosted edge infrastructure, distributed abuse defense and a new observability platform.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
