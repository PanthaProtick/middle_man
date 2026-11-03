# 06: Draft Protection, Contextual Order Review & Integrated Lifecycle

**What to build:** Complete the lifecycle hardening and cross-cutting capabilities for the conversational seller assistant. Protect uncommitted seller work with an in-chat discard prompt whenever a new chat or conflicting action is initiated while a draft form is active. Integrate contextual order review assistance as an initial advisory card in the chat stream when opened from the order review screen. Ensure tab session continuity across window minimize/reopen, and provide end-to-end regression tests across all workflows.

**Blocked by:** 03: Order Reconfirmation & Final Result Card with Buyer Link, 04: Auto-Triggered Payment Recording with Reconfirmation & Match Result, 05: Inline Work Queries for Attention & Delivery Preparation

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] If a user clicks "New Chat" or initiates a conflicting creation workflow while an unconfirmed draft form exists, an in-chat prompt appears: "You have an unconfirmed draft in progress. Discard it and proceed?" with `[Discard & Proceed]` and `[Keep Editing]`.
- [ ] Clicking `[Keep Editing]` cancels the interruption and preserves the current draft.
- [ ] Clicking `[Discard & Proceed]` clears the draft and executes the requested new chat or workflow.
- [ ] Opening the assistant from an order review screen pre-populates the chat stream with an initial Order Review Advisory card summarizing the discrepancy and recommended resolution.
- [ ] Minimizing and reopening the assistant window during an active tab session preserves the full chat history and any active draft without data loss.
- [ ] Explicitly clicking "New Chat" (when confirmed) clears chat history and returns the assistant to its clean greeting state.
- [ ] End-to-end integration tests verify draft protection, contextual review integration, and full conversational lifecycle across all 4 workflows.
- [ ] The full suite passes root `npm run conventions` and `npm run check`.
