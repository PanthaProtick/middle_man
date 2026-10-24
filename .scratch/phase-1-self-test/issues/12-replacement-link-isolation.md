# 12: Keep replacement links isolated

**What to build:** Keep an old order's buyer link limited to its own terminal status after seller replacement.

**Blocked by:** 08: Submit once and recover an uncertain response.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Eligible replacement creates a distinct order/link; the predecessor cannot submit, upload, redirect to or disclose the successor token.
- [ ] An unrevoked retained predecessor shows only its own terminal status; revoked/deleted access remains denied when those facilities are present.
- [ ] Allocated/confirmed predecessors retain existing replacement restrictions and payment single-use guarantees.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing order replacement action, public predecessor projection and upload/submission eligibility checks.

## Verification target

Existing replacement API/PostgreSQL tests plus a focused public projection/browser-component case; assert response payload and redirect behavior.

Coverage: AC30, AC34–AC36, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Adding a new replacement workflow, moving allocated funds and implementing revocation itself.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
