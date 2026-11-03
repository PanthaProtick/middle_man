# 05: Inline Work Queries for Attention & Delivery Preparation

**What to build:** Enable natural language queries or suggestion chips for orders needing attention or awaiting delivery preparation to render concise, scrollable query summary cards directly inside the chat feed. Cards display current counts, order badges, and an actionable button to apply the corresponding filter to the main seller workspace dashboard.

**Blocked by:** 01: Chat Stream Layout & Conversational Shell

**Status:** implemented

## Acceptance Criteria

- [x] Messages requesting attention backlog (e.g. "What orders need attention?", "Kaj ki baki?") or clicking the `[Attention backlog]` chip render an inline Attention Query card in the chat.
- [x] Attention cards display total count and categorized items: unresolved reviews, failed courier submissions, uncertain bookings, and pending buyer submissions.
- [x] Messages requesting delivery staging (e.g. "What orders are ready for delivery?", "Delivery preparation baki?") or clicking the `[Delivery preparation]` chip render an inline Delivery Preparation Query card in the chat.
- [x] Preparation cards display the count of confirmed orders awaiting courier drafting.
- [x] Query cards include a "View in Dashboard" action button that synchronizes and filters the main seller workspace view to that specific query.
- [x] Individual order badges on query cards allow opening or inspecting specific orders.
- [x] Integration tests verify query intent detection, data fetching, inline card rendering, and dashboard synchronization.

## Implementation notes — 2026-11-03

- Queries append independent cards to the transcript, preserving existing drafts.
  Conversation-owned snapshots retain loaded pages across minimize/reopen; token
  changes invalidate query snapshots. Existing hooks retain request race guards.
- English/Bengali/Banglish intent matching now includes the ticket examples.
- User approved expanding the shared attention membership to include
  `awaiting_buyer` orders with no courier attempt, at priority rank 4. Preview,
  dashboard, and CSV export share that predicate; contract and localized copy updated.
- Existing previews provide counts, categories, order inspection, pagination,
  retrieval timestamps, refresh/retry, and dashboard actions. Card lists are
  bounded, scrollable, keyboard focusable, and wrap order references.
- Focused checks: 16 backend attention tests; frontend parser/query/workspace
  tests, including multi-card filtering, retry, reopen pagination, authorization;
  typecheck and frontend lint passed during implementation.
- Synthetic browser preview inspected at 320px and desktop widths in English
  and Bengali. This is local mocked-data rendering, not hosted-auth/provider or
  PostgreSQL acceptance. Final gate and review results follow below.

### Final verification and review

- `npm run check`: PASS; evidence `.cache/checks/check-jBagMA/result.json`.
  Backend: 695 passed, 179 skipped. Frontend: 123 files / 670 tests passed.
  Tooling, conventions, lint, strict types, production build, HTTP smoke passed.
- Windows default pytest temp access failed on the first gate. Successful rerun
  used `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/ticket05-verified-pytest`.
  An intermediate gate exposed old active-workflow selectors; query cards now
  have a separate selector and all original draft assertions remain meaningful.
- Standards review: 0 findings. Spec review: 2 lifecycle cases found and fixed
  (reopen pagination and minimize during loading); final re-review: 0 findings.
- Main paths: seller `AssistantQueryCard.tsx`, `assistantQuerySession.ts`,
  `GuidedAssistant.tsx`, `useAssistantConversation.ts`, query hooks/previews/CSS;
  backend `models/work_query.py`, `services/attention*.py`; localized attention
  copy, shared query contract, parser and integration/backend regression tests.
- Browser: synthetic 10-order query card inspected at 320px and 1440px, including
  Bengali; no page/card horizontal overflow. Providers, hosted authentication,
  PostgreSQL integration/concurrency and physical-device acceptance remain unrun.
- Next action: no ticket implementation remains; commit on the current branch.
