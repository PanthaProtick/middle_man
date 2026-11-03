# 04: Auto-Triggered Payment Recording with Reconfirmation & Match Result

**What to build:** Enable natural language queries (in English, Bengali, or Banglish) to automatically trigger an interactive Payment Form card pre-filled with extracted payment details (account, provider, TrxID, sender number, amount). Submitting the form presents an inline reconfirmation card. Confirming records the seller transaction record via the existing submission service, reconciles against pending orders, and appends a permanent result card to the chat showing match status and order link.

**Blocked by:** 01: Chat Stream Layout & Conversational Shell

**Status:** implemented

## Acceptance Criteria

- [x] Messages expressing intent to record a payment (e.g. "Bkash received 500 tk TrxID 9K23M4 from 01711000000") auto-trigger an inline Payment Form card in the chat.
- [x] Detected fields (receiving account, provider, TrxID, sender number, amount) are pre-filled into the form controls.
- [x] Missing fields remain editable directly in the inline form controls with validation ensuring positive amount and selected account.
- [x] Clicking "Review" transitions the form to an inline reconfirmation view showing payment summary details and `[Confirm]` / `[Make Changes]` buttons.
- [x] Clicking `[Confirm]` idempotently records the seller transaction record through the existing payment submission service.
- [x] On success, an immutable Result Card is appended to the chat timeline displaying transaction ID, amount, account, and whether it automatically matched and confirmed an eligible pending order.
- [x] Clicking the "Record payment" suggestion chip opens an empty inline Payment Form card in the chat.
- [x] Integration tests verify payment parsing, form editing, reconfirmation, backend transaction creation, and reconciliation result display.

## Implementation note (2026-11-03)

The seller order opens through the existing fetched-order action in the result card; the app has no seller order URL route. Natural extraction selects only a unique active bKash or Nagad account. The existing backend submission and recovery contract was reused.

Focused parser/UI tests and seven backend transaction-submission tests passed. Root `npm run check` initially stopped because Windows denied pytest's system temp directory; it then passed with `TMP` and `TEMP` pointing to `.cache/payment-ticket-temp` (`.cache/checks/check-nHibm0/result.json`). The final gate passed after the mixed-input parser correction (`.cache/checks/check-FuXNeo/result.json`). Browser and live-provider acceptance remain unrun.
