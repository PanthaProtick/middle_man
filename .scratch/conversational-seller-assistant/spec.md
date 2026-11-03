# Conversational Seller Assistant Revamp

Status: ready-for-agent

## Problem Statement

Sellers managing fast-paced chat negotiations need a streamlined, conversational way to prepare orders, record payments, and track fulfillment without switching away from their workflow. The current seller assistant resembles a rigid form-dashboard and modal wizard rather than an authentic chatbot. Sellers must manually navigate static workflow buttons and full-screen form sections, which breaks the conversational flow and makes quick entry cumbersome.

## Solution

Revamp the seller assistant into a genuine, modern conversational chatbot interface. The assistant features an auto-scrolling chat feed with user bubbles and assistant responses. The four primary workflows (Create Order, Record Payment, Check Attention Backlog, and Find Orders Awaiting Delivery Preparation) are automatically triggered by natural language queries in English, Bengali, or Banglish. 

When a seller mentions an intent with partial details, the assistant immediately delivers an inline interactive card with extracted fields pre-filled. The seller adjusts or completes any remaining details directly using form controls, clicks "Review", inspects an inline conversational reconfirmation summary, and confirms the action. Upon confirmation, immutable result cards (with 1-click Buyer Link copy and order navigation) are permanently added to the chat log.

## User Stories

1. As a seller, I want to interact with a familiar chat interface with message bubbles and an input field, so that using the assistant feels natural and conversational.
2. As a seller, I want my messages to appear on the right side of the chat stream and the assistant's replies on the left with an avatar, so that the conversation flow is visually distinct.
3. As a seller, I want the assistant to automatically recognize my intent to create an order from natural language (English, Bengali, or Banglish), so that I don't have to click manual workflow buttons.
4. As a seller, I want the assistant to automatically recognize my intent to record a payment transaction from my chat message, so that payment entry is instant.
5. As a seller, I want the assistant to understand queries about orders needing attention, so that I can quickly surface unresolved reviews, failed bookings, or pending buyer submissions.
6. As a seller, I want the assistant to understand queries about delivery preparation, so that I can see confirmed orders ready for courier staging.
7. As a seller, I want extracted details (such as product name, total price, advance amount, or payment method) from my message to be pre-filled into an inline order form, so that I don't have to re-enter them.
8. As a seller, I want extracted payment details (such as account, provider, TrxID, sender number, and amount) from my message to be pre-filled into an inline payment form, so that I save time on manual entry.
9. As a seller, I want to edit or complete missing fields directly on the inline form controls, so that I have precise and immediate control over the submitted data.
10. As a seller, I want real-time validation on the form (e.g., ensuring delivery advance does not exceed order total, and requiring an active account), so that I cannot submit invalid data.
11. As a seller, I want to click a "Review" button on the form to transition it into an inline reconfirmation summary, so that I can verify all details before executing a mutation.
12. As a seller, I want a "Make Changes" option on the reconfirmation card that returns the form to its editable state in place, so that corrections are quick and clean.
13. As a seller, I want an explicit "Confirm" button on the reconfirmation card, so that no mutation occurs without my conscious approval.
14. As a seller, I want order creation confirmation to output a permanent result card in the chat featuring the Buyer Link, a 1-click "Copy Link" button, and an "Open Order" link, so that I can immediately share the link with my customer.
15. As a seller, I want payment recording confirmation to output a permanent result card showing the seller transaction record and any automated order reconciliation match, so that I know the payment was logged and linked.
16. As a seller, I want Attention and Delivery Preparation queries to render as compact, scrollable cards inside the chat stream with order badges and counts, so that my chat context is preserved.
17. As a seller, I want an action button on query cards to filter the main workspace dashboard, so that I can seamlessly transition to working with those orders in bulk.
18. As a seller, I want compact quick-suggestion chips docked right above the input bar, so that I can trigger common workflows with one tap when I prefer not to type.
19. As a seller, I want the assistant to respond with a helpful clarification and suggestion chips when I send an unrecognized message or greeting, so that I always know what the assistant can do.
20. As a seller, I want the assistant to respect my language preference (English or Bengali) and match the language of my messages, so that communication is effortless.
21. As a seller, I want an in-chat discard prompt if I attempt to start a new chat or workflow while an unconfirmed draft is in progress, so that I do not accidentally lose uncommitted work.
22. As a seller, I want my conversation transcript and active draft to stay intact when I minimize and re-open the assistant window during my session, so that I can check other parts of my shop without losing my place.
23. As a seller, I want to click "New Chat" in the assistant header to start a fresh thread whenever I want to clear prior context.
24. As a seller, I want the assistant to open with an initial Order Review Advisory card when launched from an order review screen, so that all advisory and conversational capabilities share one unified interface.
25. As a seller, I want double-click and network retry protections on the confirmation action, so that duplicate orders or payments are never accidentally submitted.

## Implementation Decisions

### Architectural Approach
- Transform the assistant presentation layer from a static section-swapping panel into an interactive conversational message stream.
- Message items in the conversation feed support multiple rich payload types: text messages, interactive form cards (Order / Payment), reconfirmation cards, finalized immutable result cards, query summary cards (Attention / Delivery Preparation), and discard confirmation prompts.
- Preserve the domain boundary established in ADR-0007 and ADR-0010: the assistant acts strictly as a conversational preparatory aid; all mutations require explicit seller confirmation; Gemini receives no raw conversational text or sensitive payment details.

### Message State & Reducer
- The conversation hook manages an ordered list of timeline entries:
  - `UserMessage`: raw text sent by seller.
  - `AssistantMessage`: conversational text reply.
  - `ActiveDraftCard`: inline editable form for creation/payment with pre-filled fields and live validation.
  - `ReconfirmationCard`: frozen summary of draft with `Confirm` and `Make Changes` buttons.
  - `ResultCard`: immutable record of completed action (Buyer Link, reconciliation status).
  - `QueryCard`: structured view of attention backlog or preparation items with dashboard filter links.
  - `DiscardPromptCard`: inline prompt asking whether to discard active draft.

### Intent Interpretation & Pre-fill Pipeline
- Retain and extend client-side natural language pattern matchers for English, Bengali, and Banglish.
- Upon message dispatch:
  1. Detect intent: `order`, `payment`, `attention`, `preparation`, or `unrecognized`.
  2. Extract candidate entities: amounts, advance, product description, and account references.
  3. If `order` or `payment` is detected, initiate an active draft with extracted fields pre-filled and insert the `ActiveDraftCard` directly into the chat stream.
  4. If `attention` or `preparation` is detected, query the existing work query services and append an inline `QueryCard`.
  5. If unrecognized, append a conversational clarification `AssistantMessage` with quick suggestion chips.

### Form & Reconfirmation Lifecycle
- Exactly one `ActiveDraftCard` may be active at any time.
- Clicking "Review" on the form validates inputs (advance <= total, valid account, positive numbers) and flips the active card state to `reconfirming`.
- Clicking "Make Changes" flips it back to `editing`.
- Clicking "Confirm" calls the existing idempotent submission service (`useGuidedOrderSubmission` or `useGuidedPaymentSubmission`).
- Upon success, the draft is cleared and replaced in the timeline by a permanent `ResultCard`.

### UI / Layout Structure
- **Header**: Title, language selector (English / বাংলা), "New Chat" action, and close button.
- **Body**: Scrollable feed with autoscroll-to-bottom on new events. Responsive layout: floating desktop window and full-screen mobile drawer.
- **Footer**: Docked suggestion chips (`[New order]`, `[Record payment]`, `[Attention]`, `[Preparation]`) above a chat input area with an auto-resizing text field and send button.

## Testing Decisions

### Quality Criteria for Tests
- Tests must verify external user-visible behavior and accessibility roles, avoiding assertions on internal component state or unexported helper functions.
- Every test must interact via standard user gestures (typing into chat input, clicking suggestion chips, filling form inputs, clicking review and confirm) and assert rendered text, links, role attributes, and network calls.

### Primary Testing Seams
- **Single Highest Seam (Primary)**: The feature integration seam at `AssistantWorkspace`. This mounts the full assistant window within the seller environment with mocked API endpoints. Tests verify:
  1. Sending conversational queries in English and Bengali triggers pre-filled inline forms.
  2. Editing fields on the inline form and clicking "Review" displays the reconfirmation summary.
  3. Clicking "Confirm" issues the submission request and renders the permanent result card with the Buyer Link.
  4. Querying attention/preparation renders inline cards with valid counts and dashboard navigation actions.
  5. Discard protection works when interrupting an active draft.
- **Unit / Hook Seam (Secondary)**: The conversational reducer hook (`useAssistantConversation`), verifying intent parsing, entity extraction, state transitions (idle -> drafting -> reconfirming -> completed), and locale negotiation.

### Prior Art
- `frontend/src/features/seller/AssistantWorkspace.test.tsx`
- `frontend/src/features/seller/AssistantIntegratedJourney.test.tsx`
- `frontend/src/features/seller/useAssistantConversation.test.ts`

## Out of Scope

- Direct external LLM chat with unvetted third-party APIs or transmitting raw payment numbers/product descriptions to Gemini.
- Multi-draft parallel editing (sellers complete or discard one draft at a time).
- Server-side database persistence of conversational chat history (in-memory per tab session only).
- Direct courier booking through Pathao inside the assistant (Pathao bookings remain seller-reviewed under existing courier review workflows).

## Further Notes

- Maintains strict compliance with repository size limits (files under 300 physical lines; decomposition into focused modules).
- Maintains compliance with domain conventions in `GLOSSARY.md` and authority boundaries in `ADR-0010`.
