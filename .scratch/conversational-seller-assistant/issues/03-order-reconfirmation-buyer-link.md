# 03: Order Reconfirmation & Final Result Card with Buyer Link

**What to build:** Implement the two-step confirmation and result lifecycle for order creation. When the seller completes the inline order form and clicks "Review", the card transitions into an inline summary reconfirmation view showing total, advance, remaining COD balance, and receiving account. Clicking "Make Changes" reopens the editable form in place. Clicking "Confirm" calls the existing idempotent order creation service and permanently renders a finalized result card into the chat log featuring the generated Buyer Link, a 1-click "Copy Link" button, and an "Open Order" link.

**Blocked by:** 02: Auto-Triggered Order Creation with Pre-Filled Inline Form

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Clicking "Review" on a valid inline Order Form card transitions it into an inline reconfirmation state with summary details and `[Confirm]` / `[Make Changes]` buttons.
- [ ] Clicking `[Make Changes]` reopens the form controls in place with all entered values preserved, without posting duplicate cards into the chat.
- [ ] Clicking `[Confirm]` dispatches the validated order creation request via the existing seller order submission pipeline.
- [ ] During submission, confirmation controls are disabled with a visual progress indicator to prevent duplicate clicks or concurrent requests.
- [ ] On successful submission, an immutable Result Card is permanently appended to the chat timeline displaying order reference, product, agreed amounts, the generated **Buyer Link**, a 1-click `[Copy Link]` button, and an `[Open Order]` action.
- [ ] Copying the Buyer Link shows positive transient feedback (e.g. "Copied!").
- [ ] Submission failures display clear localized error guidance on the card while preserving the entered draft data for retry.
- [ ] Integration tests verify the complete flow from form submission through reconfirmation, backend creation, link copying, and order opening.
