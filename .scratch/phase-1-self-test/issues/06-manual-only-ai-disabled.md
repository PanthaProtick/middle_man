# 06: Disable AI while preserving manual entry

**What to build:** Run the self-test with manual buyer entry while AI is explicitly disabled regardless of configured provider credentials.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Both extraction entry points, including cached replays, return the defined disabled/manual outcome without any provider call.
- [ ] Configured Gemini credentials do not enable AI in this mode; frontend controls accurately reflect backend availability.
- [ ] Manual address/payment entry and optional screenshot use remain available, and existing enabled-mode contracts remain intact for future testing.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: AI feature configuration, address/payment extraction entry points and buyer assistance controls.

## Verification target

Use offline provider spies for direct/replayed requests with credentials configured and feature tests for disabled controls/manual submission.

Coverage: AC09, disabled portion of AC10, AC49. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Live Gemini requests, model evaluation and provider privacy acceptance.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
