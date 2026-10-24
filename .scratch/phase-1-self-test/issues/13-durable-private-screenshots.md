# 13: Persist and privately retrieve screenshots

**What to build:** Upload a generated screenshot, restart the application and let only the owning seller retrieve the preserved image.

**Blocked by:** 08: Submit once and recover an uncertain response; 09: Bound public request admission.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A persistent repository-local evidence folder is ignored before files are created; no upload is tracked or mounted as public static content.
- [ ] Valid images persist with their database ownership metadata across restart; opaque storage keys cannot escape the intended root.
- [ ] Only owning-seller reads succeed; buyer/foreign evidence IDs and ineligible order uploads are rejected. Preserve image byte/pixel/count validation and bounded ingress.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing evidence storage interface, startup wiring, upload validation, seller viewer and local ignore configuration.

## Verification target

API upload/private-read tests, real filesystem restart evidence, Git ignore/tracked-file checks and existing upload/viewer feature tests.

Coverage: AC02, AC11, AC39, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Drive/cloud storage, full I/O fault cleanup and retention orchestration.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
