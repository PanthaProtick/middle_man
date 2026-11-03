# 02: Auto-Triggered Order Creation with Pre-Filled Inline Form

**What to build:** Enable natural language queries (in English, Bengali, or Banglish) to automatically trigger an interactive, editable Order Form card directly in the chat feed. The assistant parses candidate values from the message—such as product description, order total, and advance amount—and pre-fills them into the inline card. Missing required fields (such as receiving account selection) remain editable directly on the form controls with real-time validation.

**Blocked by:** 01: Chat Stream Layout & Conversational Shell

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Sending a message expressing intent to create an order (e.g. "Create order for 1500 taka silk saree, advance 300") triggers an inline Order Form card inside the message stream.
- [ ] Candidate fields parsed from the message (product name, order total, delivery advance) are pre-filled in the form.
- [ ] If fields are missing from the message (such as the receiving account), the form renders with those fields editable and ready for seller input.
- [ ] The inline form card allows direct editing of product name, order total, delivery advance, receiving account, and optional parcel weight/notes.
- [ ] Real-time validation ensures that delivery advance is positive and does not exceed the order total, and that an active receiving account is selected.
- [ ] Clicking the "New order" quick-suggestion chip opens an empty inline Order Form card in the conversation feed.
- [ ] Focused tests at the workspace seam verify Bengali, English, and Banglish intent detection, field extraction, and interactive form input updates.
