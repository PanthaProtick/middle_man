# 03: Record seller transactions through guided conversation

**What to build:** Record received-payment evidence with explicit seller confirmation and display its actual reconciliation outcome.

**Blocked by:** 02: Create orders through guided conversation (shared confirmed-action and submission-recovery mechanism).

**Status:** implemented; local verification passed; browser/PostgreSQL acceptance not run

- [x] Collect receiving account, exact transaction ID, and positive amount locally using structured fields; derive provider from account. Sender number and occurrence time stay optional under existing contracts.
- [x] Clarify missing/invalid fields and ambiguous account/amount selection; preserve entered identifiers and valid fields across corrections and failures.
- [x] Preview clearly states that recording evidence invokes existing reconciliation and may automatically confirm an eligible order; require Record payment confirmation.
- [x] Reuse authorized domain rules and confirmed-action recovery. Revalidate current account/state, prevent duplicate submissions, and preserve existing identical/conflicting-evidence handling without overwriting conflicts.
- [x] Show a linked actual transaction result and actual reconciliation result, distinguishing unmatched evidence, duplicate/conflict outcomes, and eligible order confirmation without claiming provider verification.
- [x] Keep transaction identifiers, phone numbers, pasted SMS, and arbitrary raw messages away from external models and persisted conversation logs.
- [x] Cover bilingual entry, account ambiguity, optional fields, authorization, exact identifier preservation, reconciliation success/failure, stale state, duplicate/concurrent submission, and lost-response recovery with meaningful tests.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

## Implementation and handoff — 2026-11-01

Base: `3b78ac1ad4354b72f131e9d9bca0b2bd873a427c`; current branch: `main`.
The user approved a new confirmed-action payment API and the guided assistant as the
TDD seams, reusing ticket 02's epoch/key/shop-lock mechanism.

- Added authenticated `GET/POST/GET /api/seller/transaction-submissions` routes.
  Context returns `{storage_epoch}`; POST returns
  `{receipt, allocated_order_ids}`; lookup returns
  `{state: "succeeded"|"not_found", result}`. The existing
  `/api/seller/transactions` behavior is unchanged.
- Reused `record_observation` with `commit=False` so the receipt, transaction,
  observations, and reconciliation changes commit once. `allocated_order_ids` is
  derived from the current receipt comparison/allocation, not cached receipt JSON.
  Provider, account ownership, and active status are revalidated; an inactive account
  returns `422 PAYMENT_ACCOUNT_INACTIVE`.
- Added bilingual structured entry (`account:`, `trx id:`, `amount:`,
  `sender number:`, `occurred at:` and Bengali/Banglish equivalents). Exactly one
  active account is required; a provider shared by multiple accounts stays
  ambiguous. Transaction IDs preserve exact case and internal spacing.
- Preview states that recording runs reconciliation and may auto-confirm an eligible
  order, and that this is not provider verification. Only explicit **Record payment**
  submits. Unknown outcomes freeze fields; lookup must succeed before retrying the
  same identity. Definitive inactive/validation failures preserve editable fields.
- Results distinguish unmatched, identical duplicate, preserved conflict, and an
  actual allocated order. An identical replay that now has an allocation shows the
  confirmed order rather than masking it as a duplicate. Result actions open the
  exact receipt in the payments inbox or fetch the actual seller order.
- Conversation text, identifiers, phone numbers, and submission identities remain in
  React state/request bodies only; no external-model or conversation-log persistence.

Changed paths: `backend/app/{api/transaction_submissions,models/transaction_submission,
services/transaction_submission,services/transaction_service,main}.py`;
`backend/tests/test_transaction_submissions.py`; seller assistant conversation,
workspace, window, payment fields/result, payment submission hook, local parser, and
tests; `frontend/src/features/locale/guidedPaymentCopy.ts`; `types.ts`; API contract
index and new `docs/contracts/guided-transaction-entry.md`.

Verification: focused backend 7 passed; focused payment UI/parser 13 passed; existing
guided-order/assistant suites 20 passed. Independent Standards and Spec reviews found
and were fixed for: identical replay masking a new allocation, recovery-auth guidance,
account ambiguity copy, account refresh, and provider/receipt detail display. Initial
missing-route/parser tests failed before implementation.

Final root `npm run check` passed: tooling, conventions, backend lint/types,
frontend lint, backend tests 650 passed / 179 skipped, frontend tests 531 passed
across 100 files, production build, and HTTP smoke. Evidence:
`.cache/checks/check-NNe3jz/result.json`.

Remaining acceptance: real browser/mobile, hosted Clerk, disposable PostgreSQL
concurrency/rollback, and live payment-provider behavior are not run. Mock DOM and
offline-memory tests do not prove those. Automated verification made zero live Gemini
or payment-provider calls. Next: commit this change on `main`, then ticket 04 when
requested.
