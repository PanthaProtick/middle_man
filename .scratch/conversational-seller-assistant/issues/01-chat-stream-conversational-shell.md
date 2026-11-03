# 01: Chat Stream Layout & Conversational Shell

**What to build:** Transform the seller assistant window into a modern, conversational chat interface with an auto-scrolling message feed. The seller sees their messages aligned to the right and the assistant's responses on the left with an avatar. The header provides the assistant title, language switcher (English / বাংলা), "New Chat" reset action, and close button. When the seller sends a greeting or an unrecognized message, the assistant conversationally clarifies what it can do and displays docked quick-suggestion chips above an auto-resizing text input.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] The assistant window presents an auto-scrolling message timeline replacing the previous static split/wizard view.
- [ ] User messages are visually styled as right-aligned speech bubbles; assistant messages appear on the left with an avatar and timestamp.
- [ ] The header contains the assistant title, a functional locale toggle (en/bn), a "New Chat" button, and an accessible close button.
- [ ] Docked quick-suggestion starter chips (`[Create order]`, `[Record payment]`, `[Attention backlog]`, `[Delivery preparation]`) appear directly above the chat input box.
- [ ] Submitting a greeting or unrecognized text produces a friendly, localized conversational clarification alongside the suggestion chips.
- [ ] The chat input field supports auto-resizing multi-line text entry and keyboard submission (Enter to send, Shift+Enter for new line).
- [ ] The component passes keyboard navigation, focus trap on open, and screen-reader polite log announcements.
- [ ] Focused tests at the assistant workspace seam verify rendering, message posting, locale switching, and starter chip interactions.

## Implementation — 2026-11-03

Implemented the conversational shell in AssistantWindow, GuidedAssistant, and
AssistantChat.css. Messages retain send timestamps; the feed scrolls on new
messages/workflow events. The docked composer supports bounded auto-resizing,
Enter submission, Shift+Enter, and IME composition. General chat traps Tab and
retains Escape dismissal and existing opener restoration. Header language and
reset controls retain draft-discard safeguards. Clarification copy describes
available capabilities in English and Bengali. Existing workflow cards and
submission contracts remain intact for subsequent tickets.

Verification:
- AssistantShell.test.tsx: observed red before implementation, then green.
- Focused shell + workspace: 6 tests passed.
- npm run typecheck: passed.
- First npm run check: Windows pytest temp-directory permission error.
- Final npm run check with repository-local PYTEST_ADDOPTS basetemp: passed;
  evidence: .cache/checks/check-hOoZna/result.json.
- Standards review: no findings. Spec review: clarification wording and docked
  footer containment findings addressed.
- Browser visual, scroll geometry, and screen-reader acceptance remain unrun.
  Validate desktop/mobile and Bengali rendering before claiming visual acceptance.
