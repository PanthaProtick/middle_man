# 15: Verify durable receipt-to-confirmation behavior

**What to build:** Use synthetic manual/SMS transaction records to confirm an eligible submitted order exactly once with correct remaining COD.

**Blocked by:** 03: Separate payment-marker protection from Clerk credentials; 08: Submit once and recover an uncertain response.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Both receipt/submission arrival orders produce the same qualifying durable confirmation; unsupported SMS stays visibly unresolved with manual entry and no AI call.
- [ ] Exact provider/account/TrxID/sender/amount/time checks and duplicate observation handling remain intact; masked/ambiguous data is not guessed.
- [ ] Restart and same-key retries preserve fixed terms, one allocation, accepted amount and consistent seller/buyer COD.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing receipt entry/import, deterministic reconciliation, allocation and seller/buyer status surfaces.

## Verification target

Run existing focused PostgreSQL receipt/SMS/matching cases and add only demonstrated-gap regressions; record one synthetic seller-to-buyer confirmation journey.

Coverage: AC03, AC06, AC08, AC12–AC18, AC21, AC37, AC39, AC49. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Rewriting completed reconciliation or claiming representative live-SMS support.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
