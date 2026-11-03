# 02: Auto-Triggered Order Creation with Pre-Filled Inline Form

**What to build:** Enable natural language queries (in English, Bengali, or Banglish) to automatically trigger an interactive, editable Order Form card directly in the chat feed. The assistant parses candidate values from the message—such as product description, order total, and advance amount—and pre-fills them into the inline card. Missing required fields (such as receiving account selection) remain editable directly on the form controls with real-time validation.

**Blocked by:** 01: Chat Stream Layout & Conversational Shell

**Status:** completed

## Acceptance Criteria

- [x] Sending a message expressing intent to create an order (e.g. "Create order for 1500 taka silk saree, advance 300") triggers an inline Order Form card inside the message stream.
- [x] Candidate fields parsed from the message (product name, order total, delivery advance) are pre-filled in the form.
- [x] If fields are missing from the message (such as the receiving account), the form renders with those fields editable and ready for seller input.
- [x] The inline form card allows direct editing of product name, order total, delivery advance, receiving account, and optional parcel weight/notes.
- [x] Real-time validation ensures that delivery advance is positive and does not exceed the order total, and that an active receiving account is selected.
- [x] Clicking the "New order" quick-suggestion chip opens an empty inline Order Form card in the conversation feed.
- [x] Focused tests at the workspace seam verify Bengali, English, and Banglish intent detection, field extraction, and interactive form input updates.

## Implementation — 2026-11-03

- Base commit: `86988902017e094c42c91650233730080d4d4e48`; initial checkout clean.
- Reused the existing intent router, inline GuidedOrderFields, active-account
  validation, and confirmed submission pipeline. Added local sentence candidates
  in `orderMessageCandidates.ts`, integrated through `guidedOrder.ts`.
- Added workspace integration coverage in `AssistantOrderForm.test.tsx` for
  English/Bengali/Banglish, missing accounts, empty quick-start, direct edits,
  malformed/repeated amounts, product digits, and price-only messages.
- Localized the New order suggestion in sellerAssistantCopy/GuidedAssistant;
  adjusted three existing assistant test files to its new label.
- Preserved optional weight/quantity. Notes are absent from the current order
  contract; no unsaved notes control or backend contract expansion was added.
- Two-stage reconfirmation and permanent result history remain ticket 03 scope.
- Observed failing workspace cases before implementation; focused tests now pass
  (37 tests across form, guided creation, workspace, and intent suites; 13 tests
  across form and adjacent lifecycle/query suites at the earlier slice).
- `npm run typecheck`: passed twice. Final focused form/guided suite: 18 passed.
- Standards review: 1 ambiguity finding addressed; re-review: 0 remaining.
- Spec review: 1 product-span finding addressed; re-review: 0 remaining.
- Final root npm run check: PASS (all nine stages); evidence:
  `.cache/checks/check-ACpAxD/result.json`.
- Used repository-local PYTEST_ADDOPTS basetemp for Windows temp permissions.
- Browser geometry, mobile rendering, and screen-reader acceptance unrun.
- Pre-commit full gate also passed: `.cache/checks/check-TV00dj/result.json`.
- Next work: ticket 03 owns two-step reconfirmation and permanent result history.
