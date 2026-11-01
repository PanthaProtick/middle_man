# 03: Record seller transactions through guided conversation

**What to build:** Record received-payment evidence with explicit seller confirmation and display its actual reconciliation outcome.

**Blocked by:** 02: Create orders through guided conversation (shared confirmed-action and submission-recovery mechanism).

**Status:** ready-for-agent

- [ ] Collect receiving account, exact transaction ID, and positive amount locally using structured fields; derive provider from account. Sender number and occurrence time stay optional under existing contracts.
- [ ] Clarify missing/invalid fields and ambiguous account/amount selection; preserve entered identifiers and valid fields across corrections and failures.
- [ ] Preview clearly states that recording evidence invokes existing reconciliation and may automatically confirm an eligible order; require Record payment confirmation.
- [ ] Reuse authorized domain rules and confirmed-action recovery. Revalidate current account/state, prevent duplicate submissions, and preserve existing identical/conflicting-evidence handling without overwriting conflicts.
- [ ] Show a linked actual transaction result and actual reconciliation result, distinguishing unmatched evidence, duplicate/conflict outcomes, and eligible order confirmation without claiming provider verification.
- [ ] Keep transaction identifiers, phone numbers, pasted SMS, and arbitrary raw messages away from external models and persisted conversation logs.
- [ ] Cover bilingual entry, account ambiguity, optional fields, authorization, exact identifier preservation, reconciliation success/failure, stale state, duplicate/concurrent submission, and lost-response recovery with meaningful tests.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

