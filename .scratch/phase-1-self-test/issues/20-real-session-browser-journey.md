# 20: Record the real-session manual browser journey

**What to build:** Record an actual local manual workflow with two Clerk test identities, the dedicated Neon development database and generated evidence.

**Blocked by:** 05: Handle session loss and reject foreign-shop access; 13: Persist and privately retrieve screenshots; 15: Verify durable receipt-to-confirmation behavior.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Record revision, local URLs, sanitized target identity and dated observations for setup, receiving account, fixed order, link, manual buyer form, optional image and confirmation.
- [ ] Demonstrate two-shop separation and real sessions, and verify order/image persistence after restart with AI disabled.
- [ ] Preserve privacy-safe observations and mark failures/unrun portions explicitly; intercepted HTTP, fake tokens and direct database probes do not substitute for this journey.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing setup/order/buyer/evidence/status UI and approved local browser acceptance checklist; no test-only public/auth overrides.

## Verification target

Use actual local browser operations and application requests against intended providers. This is an evidence ticket; route any substantial discovered implementation fix back to its owning ticket.

Coverage: Browser evidence for AC01–AC09, AC12, AC16, AC39, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Hosted browser acceptance, real order data and live Gemini.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
