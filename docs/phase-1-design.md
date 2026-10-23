# Phase 1: Seller-assisted order confirmation

Status: shared understanding approved by the user, 2026-10-23.
No Phase 1 implementation or live-provider acceptance is claimed.

This document consolidates the interview decisions and takes precedence over
conflicting Phase 1 proposals in [idea.md](idea.md). Decision history is in
[the interview record](../tasks/phase-1-design.md); domain terms are in
[GLOSSARY.md](../GLOSSARY.md).

## Purpose and pilot boundary

- Reduce the seller's total work collecting buyer details and reconciling advances.
- Start with sellers already collecting advances, with one confirmation operator per shop.
- Keep every shop's orders, received-payment records and checks entirely separate.
- Confirmation means seller acceptance of the order and advance. It does not mean
  the payment provider independently verified receipt through this application.
- Measure fraud incidents and COD returns without promising improvement.

## Seller and buyer flow

1. The seller sets up a shop and its bKash/Nagad receiving accounts.
2. After agreement in chat, the seller creates a unique order link containing the
   product, final order total, required advance and designated receiving account.
3. The total includes agreed delivery charges where applicable. Phase 1 does not
   calculate courier prices or add charges after the agreement.
4. The buyer supplies name, contact number, a complete readable address and payment
   details, including TrxID and a separate payment sender number. Someone else may
   pay on the buyer's behalf; contact number and sender number need not agree.
5. Screenshot upload is optional. The buyer can enter all details manually.
6. Optional Gemini assistance structures an address or extracts screenshot fields.
   Explain the data transfer before the buyer chooses it; the buyer reviews the
   result. Preserve original address text and allow manual correction.
7. The server accepts the completed form. The order awaits payment matching.
8. The seller pastes received-payment SMS or manually enters transaction details
   observed in the payment app, identifying the receiving account and source.
9. A qualifying unambiguous match confirms automatically. Exceptions require seller
   review. The order link provides its status; internal review reasons need not be
   presented as fraud accusations to the buyer.
10. The seller has an order summary with the remaining COD balance, copy and CSV
    export as proposed in the original scope. Delivery booking is outside Phase 1.

## Received-payment records and automatic matching

SMS parsing is deterministic. An unrecognised or incomplete message stays visibly
unresolved; the seller can enter the transaction from their payment app. SMS is not
sent to Gemini as a parser fallback. AI never determines payment acceptance.

Automatic matching requires all of the following:

- The order and transaction belong to the same shop.
- Provider and designated receiving account agree.
- Both TrxID and payment sender number agree with the buyer's claim.
- The received amount exactly equals the required advance.
- Seller-side payment time is clear and between order creation and the buyer's
  payment submission. Earlier, future-dated or unclear times require review.
- The received transaction has not already funded another order in the shop.
- There is no unresolved competing claim or conflicting seller transaction record.
- The order is eligible for matching, rather than cancelled or already resolved.

The receiving account must be identified explicitly when the SMS does not contain
it. Missing or masked sender information cannot be silently treated as full agreement.
Import time is not payment time. Seller records may arrive before buyer submissions;
matching is attempted when either side arrives. Unmatched does not mean invalid.

Identical repeated records do not create more payments. Conflicting records remain
visible for seller resolution and cannot silently overwrite an accepted payment.
Buyer claims alone neither reserve a transaction nor consume its single permitted use.
Changing a claimed sender must not create another usable copy of a used transaction.

## Exceptions and seller decisions

- Manual confirmation always needs a seller transaction record and an explanation
  for any exception. It cannot override single use of a received transaction.
- The seller can explicitly accept a different advance amount after reviewing the
  revised balance. Remaining COD equals final order total minus actual accepted advance.
- Payments exceeding the entire total remain unresolved for external handling.
  Refund processing and customer-credit management are outside Phase 1.
- Payments before link creation can be reviewed and accepted manually.
- When different pending orders claim the same received payment, the seller resolves
  which order it belongs to; submission order alone does not choose the winner.
- A competing claim arriving after confirmation stays unresolved and alerts the
  seller. It cannot automatically reverse confirmation or reuse the accepted payment.
- One payment funding several orders and split payments funding one order are deferred.

## Expiry, corrections and cancellation

- Initial submission must succeed within 48 hours after link creation. Opening the
  page or partially filling a draft does not prevent expiry.
- After the first successful completed submission, the order never automatically
  expires, including after failed matching or subsequent seller corrections.
- Expiry does not imply that money was not received; late-payment cases need review.
- The buyer contacts the seller to correct submitted information. The owning seller
  must be authenticated to edit, even when opening the same URL given to the buyer.
- Before confirmation, relevant seller corrections retrigger checking; confirmation
  still requires the resulting checks to pass. Keep correction and decision history.
- After confirmation, allow logged edits to name, contact number and address. Accepted
  payment details and commercial terms remain locked; payment reassignment needs a
  separate resolution process rather than a generic edit.
- Correct payment details do not establish that the address or contact details are right.
- Portal corrections do not update delivery bookings. Sellers manually restage a
  delivery or request a provider update; courier workflows belong to the next phase.
- Product, total, required advance and receiving account are fixed at link creation.
  A changed agreement requires an explicitly replaced order, with seller reconciliation
  of any submitted or received payment instead of silent carryover.
- Sellers can cancel explicitly with a reason. Cancellation stops automatic matching,
  preserves payment history, does not imply a refund and does not automatically free
  an accepted payment for another order.
- The proposed buyer rejection/resubmission loop and three-submission cap are not
  adopted; corrections are seller-assisted. A seller may still decline an order.

## Evidence and record retention

These are initial product policies, not verified legal retention requirements.

| Data | Agreed policy |
| --- | --- |
| Uploaded screenshots and raw pasted SMS | Delete 30 days after collection; explain this period |
| Completed orders and structured payment/audit records | Retain 12 months after completion |
| Unresolved orders | Remain available until the seller resolves them |
| Minimal used-transaction marker | Keep while the shop remains active, to prevent reuse after personal-data deletion |

Original-evidence deletion must not reset order state or release an accepted payment.
Later disputes may require the seller to recheck the payment app. Account deletion
needs explicit data-removal handling before launch. Implementation must define what
counts as completion, including cancelled and expired orders, and apply the policy
consistently to stored AI outputs, logs and backup lifecycle rather than retaining
copies of raw evidence accidentally.

## Deferred work and launch gates

- Buyer identity/link-access policy was explicitly deferred. Do not treat this as
  approval for anonymous seller edits or as a completed public-launch access design.
- Defer courier integration and location mapping, cross-shop payment reuse detection,
  shared receiving-account workflows, buyer reputation, bots, SMS forwarding, buyer
  notifications, seller teams, payment processing, refunds and credit balances.
- The current repository is a React/Vite and FastAPI starter. Product persistence
  and authentication are not established by database/Clerk configuration flags.
- Before a real pilot, demonstrate persistent, authenticated shop isolation;
  single-use payment allocation under concurrent requests; correction/cancellation
  handling; and failure behavior without synthetic confirmation or lost records.
- Before AI processing, verify current provider data terms, model configuration and
  the actual disclosure/choice flow. No current model quality or privacy compliance
  claim is made by this discussion.
- Before public launch, finish the deferred access and account-deletion policies.

## Receipt-format evidence, checked 2026-10-23

[bKash's Personal Retail Account documentation](https://www.bkash.com/en/page/personal-retail-account)
publishes receipt templates with amount, payer account, TrxID and payment date/time;
ordinary receipt templates omit the receiving account. These placeholders do not
establish full, unmasked sender availability across every account type.
[bKash's FAQ](https://www.bkash.com/en/customer-service/faq) describes a transaction ID
as a unique transaction reference, without establishing cross-provider guarantees.

Bounded primary-source research did not establish an official Nagad incoming-SMS
template or precise TrxID guarantees. This is an evidence gap, not proof of absence.
Representative sanitised bKash and Nagad samples, with permission, are still needed
before claiming parser support. Unclear fields go to review, not relaxed matching.

## Acceptance evidence

- Test successful matches, all mismatches, missing/masked fields, duplicate imports,
  conflicting records, competing claims, both arrival orders and concurrent allocation.
- Verify distinct contact/sender numbers, seller-authorised corrections, fixed terms,
  amount exceptions, expiry boundaries, cancellation and retention without payment reuse.
- Exercise the real mobile buyer-to-seller flow, manual-only operation and AI outage
  fallback; mocked tests or HTTP smoke do not establish browser/provider behavior.
- Run the repository's focused tests and root `npm run check` for implementation changes.
- Pilot with the originally proposed small seller group and compare total seller
  handling time against observed baseline, including link creation, SMS entry and
  exceptions. Measure buyer completion and repeated use. Set a numerical saving
  target after baseline observation; a high auto-match rate alone is insufficient.

The [implementation specification](../.scratch/phase-1-order-confirmation/spec.md)
records the next level of detail. Implementation tickets, code and deployment are
separate work; approval of this design does not establish live readiness.
