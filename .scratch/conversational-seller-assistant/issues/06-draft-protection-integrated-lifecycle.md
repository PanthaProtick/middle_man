# 06: Draft Protection, Contextual Order Review & Integrated Lifecycle

**What to build:** Complete the lifecycle hardening and cross-cutting capabilities for the conversational seller assistant. Protect uncommitted seller work with an in-chat discard prompt whenever a new chat or conflicting action is initiated while a draft form is active. Integrate contextual order review assistance as an initial advisory card in the chat stream when opened from the order review screen. Ensure tab session continuity across window minimize/reopen, and provide end-to-end regression tests across all workflows.

**Blocked by:** 03: Order Reconfirmation & Final Result Card with Buyer Link, 04: Auto-Triggered Payment Recording with Reconfirmation & Match Result, 05: Inline Work Queries for Attention & Delivery Preparation

**Status:** completed

## Acceptance Criteria

- [x] If a user clicks "New Chat" or initiates a conflicting creation workflow while an unconfirmed draft form exists, an in-chat prompt appears: "You have an unconfirmed draft in progress. Discard it and proceed?" with `[Discard & Proceed]` and `[Keep Editing]`.
- [x] Clicking `[Keep Editing]` cancels the interruption and preserves the current draft.
- [x] Clicking `[Discard & Proceed]` clears the draft and executes the requested new chat or workflow.
- [x] Opening the assistant from an order review screen pre-populates the chat stream with an initial Order Review Advisory card summarizing the discrepancy and recommended resolution.
- [x] Minimizing and reopening the assistant window during an active tab session preserves the full chat history and any active draft without data loss.
- [x] Explicitly clicking "New Chat" (when confirmed) clears chat history and returns the assistant to its clean greeting state.
- [x] End-to-end integration tests verify draft protection, contextual review integration, and full conversational lifecycle across all 4 workflows.
- [x] The full suite passes root `npm run conventions` and `npm run check`.

## Implementation record — 2026-11-03

- Base: `9b6f8216117140d4a3ca5b192f8e969261ab1067`; current branch retained.
- User approved rendered assistant UI / existing integration harness seams.
- Discard prompt has Keep Editing and Discard & Proceed, with Bengali copy.
  Pending workflow requests retain parsed details; explicit same-workflow new/
  another requests and creation chips protect existing drafts. Field corrections
  remain editable without replacement. No writes occur on discard or switching.
- Contextual review is rendered at the start of the chat feed using the existing
  authorized, freshness-checked advisory panel. Composer, history, and draft stay
  available. Minimize/reopen restores eligible review context; confirmed New Chat
  clears it together with the transcript, composer, and draft.
- Changed paths: seller conversation hook, workspace/window/feed, discard prompt,
  chat CSS, English/Bengali copy, lifecycle and integrated journey tests; existing
  confirmation tests updated for the specified action labels.
- Focused regression checks passed, including 27 tests across lifecycle, order
  form, guided order, and payment entry; final lifecycle/integrated run: 7 passed.
  Root typecheck and conventions passed.
- Standards review: 0 findings. Spec review found replacement wording gaps;
  both fixed with regressions, final re-review: 0 unresolved findings.
- Synthetic browser inspected at 320x800 and 1440x1000, English/Bengali:
  prompt, keep editing, contextual advice, minimize/reopen, and confirmed reset.
  At 320px page width and chat feed scroll width equal their client widths.
  Screenshot: `.cache/ticket06-browser-desktop.png`.
- Four-workflow lifecycle automation uses rendered React UI and mocked HTTP;
  this is not live-provider, hosted-auth, PostgreSQL, or physical-device acceptance.
- Final root check: PASS, `.cache/checks/check-jJrkfG/result.json`. Backend: 695 passed / 179 skipped; frontend: 124 files / 676 tests passed. Tooling, conventions, lint, types, build, and HTTP smoke passed.
- Earlier gates found a reset-effect lint violation and an outdated multilingual test assumption. Reset now uses an action callback; the test explicitly confirms replacement and still checks all language assertions. Final focused workspace/lifecycle tests: 11 passed.
- Next action: commit on the current branch; mandatory pre-commit hook reruns the full gate.
