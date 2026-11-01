# 01: Unify the floating seller assistant and contextual review

**What to build:** Open one bilingual seller assistant throughout the signed-in seller workspace, switching clearly between general guided workflows and existing order review.

**Blocked by:** None (can start immediately).

**Status:** implemented; local verification passed; browser/mobile acceptance not run

- [x] Floating launcher is absent from buyer/public pages; desktop uses a compact window and mobile a full-width sheet without blocking primary controls.
- [x] Existing order review works in the shared host with explicit context and no simultaneous competing panels; preserve current freshness and navigation protections.
- [x] Offer the four supported workflows locally and clarify unsupported or unrecognized requests without external calls. Understand workflow requests in Bengali, English, Banglish, and mixed language; provide an explicit language switch independent of app locale.
- [x] Closing/reopening preserves temporary conversation and at most one creation draft. Contextual review and searches preserve that draft; switching creation workflows offers resume/discard.
- [x] New conversation or explicit discard asks before losing an unfinished draft. Reload, sign-out, and shop changes clear context; do not persist chat history.
- [x] Deliver keyboard access, screen-reader labels, focus restoration, reduced-motion support, polished bilingual states, and regression coverage for existing review behavior.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

## Implementation and handoff — 2026-11-01

Base: `d66ce9f9bc53f620320b670408734fe6a78c7a24`; branch: `main`.

- Moved shared assistant ownership to the signed-in shop workspace. Order lists
  register review eligibility with the parent; standalone review integration remains.
  The same window and launcher move into order details, including confirmed orders.
- Added local intent selection for all four workflows, Bengali/English/Banglish/
  mixed requests, local unsupported/multi-intent clarification, and independent
  conversation language. No raw message is sent to a provider or persisted.
- Retained conversation, unsent composer text, and one creation starter draft in
  React state. Search selection and contextual review preserve it. New conversation,
  explicit discard, and switching creation type use a resume/discard prompt.
  Same-shop Refresh preserves it; session/shop replacement and reload clear it.
- Starter drafts collect product name or transaction ID only. Actual guided
  collection/confirmation/submission belongs to tickets 02–03; query execution and
  dashboard integration belong to 04–05. Search selection truthfully says no query
  has run. No fake result or successful write is shown.
- Added compact desktop/full-width mobile styling, reduced-motion overrides,
  keyboard dismissal/focus restoration, focused discard prompts, and review language
  metadata. Shared header precedes review content in both DOM and visual order.

Changed paths: `frontend/src/features/seller/{AssistantWorkspace,
useAssistantWorkspace,SellerWorkspace,OrderDetailModal,ReviewAssistant}`; new
`AssistantWindow`, `GuidedAssistant`, `AssistantDiscardPrompt`,
`assistantConversation`, `useAssistantConversation`, `SellerAssistant.css`,
`AssistantWorkspace.test.tsx`, `AssistantDraftLifecycle.test.tsx`; localized copy
in `frontend/src/features/locale/sellerAssistantCopy.ts`.

Verification:

- Focused UI suites and `npm run typecheck` passed during implementation.
- Standards and Spec reviews against the base completed with zero remaining
  findings after fixing composer reset/preservation, review language metadata,
  DOM/keyboard ordering, and same-shop Refresh draft loss.
- First `npm run check`: stopped at the Windows system-temp permission error in
  `test_smoke_environment`; 638 backend tests passed, 177 skipped, one setup error.
  Evidence: `.cache/checks/check-aI0A80/result.json`.
- Final `npm run check` passed with process-local
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-seller-assistant-20261101-1`.
  Backend: 639 passed, 177 skipped. Frontend: 510 passed across 96 files. Tooling,
  conventions, lint, types, production build, and HTTP smoke passed.
  Evidence: `.cache/checks/check-Ei3bzI/result.json`.
- Zero live Gemini calls. Browser/mobile visual and assistive-technology acceptance,
  hosted Clerk/real providers, and PostgreSQL integration were not run. Checkboxes
  describe implemented behavior with automated/CSS evidence, not browser acceptance.

Remaining risk: local intent recognition is deliberately bounded; unmatched wording
gets clarification and explicit workflow choices. Next: browser desktop/mobile
acceptance, then ticket 02's guided order fields and confirmed-action contract.

