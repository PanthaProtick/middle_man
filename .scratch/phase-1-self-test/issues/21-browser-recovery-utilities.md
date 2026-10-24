# 21: Record browser recovery and seller utilities

**What to build:** Exercise link access changes, recoverable failures, mobile interaction and order handoff utilities in the real local browser.

**Blocked by:** 11: Reissue a link for the same order; 12: Keep replacement links isolated; 14: Recover from screenshot storage failures; 16: Verify conflict and correction recovery; 20: Record the real-session manual browser journey.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Record revoke/reissue/replacement behavior and buyer retry/offline/visibility recovery without stale status/private data; cover mobile layout, keyboard use and readable errors.
- [ ] Exercise storage failure recovery and seller review/correction/exception paths through the UI without claiming new domain behavior.
- [ ] Paste actual copied link/summary into another application and import the actual CSV; check Bangla, quoting, formula-like text and correct balances.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing buyer/seller UI, access actions, polling/retry behavior, evidence errors, clipboard and CSV controls.

## Verification target

Record dated browser/app observations on the same candidate and real provider setup as ticket 20. Record defects with reproducers and send nontrivial changes to the owning ticket.

Coverage: Browser evidence for AC10 disabled/manual, AC11, AC19–AC21, AC24–AC38, AC45–AC48 plus link-access cases. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Broad UI redesign, courier integrations and hosted/native-browser permission guarantees beyond observed behavior.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
