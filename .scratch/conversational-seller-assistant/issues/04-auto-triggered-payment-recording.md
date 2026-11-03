# 04: Auto-Triggered Payment Recording with Reconfirmation & Match Result

**What to build:** Enable natural language queries (in English, Bengali, or Banglish) to automatically trigger an interactive Payment Form card pre-filled with extracted payment details (account, provider, TrxID, sender number, amount). Submitting the form presents an inline reconfirmation card. Confirming records the seller transaction record via the existing submission service, reconciles against pending orders, and appends a permanent result card to the chat showing match status and order link.

**Blocked by:** 01: Chat Stream Layout & Conversational Shell

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Messages expressing intent to record a payment (e.g. "Bkash received 500 tk TrxID 9K23M4 from 01711000000") auto-trigger an inline Payment Form card in the chat.
- [ ] Detected fields (receiving account, provider, TrxID, sender number, amount) are pre-filled into the form controls.
- [ ] Missing fields remain editable directly in the inline form controls with validation ensuring positive amount and selected account.
- [ ] Clicking "Review" transitions the form to an inline reconfirmation view showing payment summary details and `[Confirm]` / `[Make Changes]` buttons.
- [ ] Clicking `[Confirm]` idempotently records the seller transaction record through the existing payment submission service.
- [ ] On success, an immutable Result Card is appended to the chat timeline displaying transaction ID, amount, account, and whether it automatically matched and confirmed an eligible pending order.
- [ ] Clicking the "Record payment" suggestion chip opens an empty inline Payment Form card in the chat.
- [ ] Integration tests verify payment parsing, form editing, reconfirmation, backend transaction creation, and reconciliation result display.
