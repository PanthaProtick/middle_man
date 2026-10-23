# Task: Phase 1 design interview

Status: Completed

- Goal: sharpen only Phase 1 of `docs/idea.md` through grilling and domain modeling, then produce the user-requested implementation specification.
- Scope exclusions: implementation and later roadmap phases.
- Acceptance: settle the design tree, record agreed terminology and decisions, and obtain the user's confirmation of shared understanding before implementation.

## Settled decisions

Round 1, accepted by the user on 2026-10-23:

1. Primary outcome: reduce seller handling time for collecting details and reconciling advances. Buyer completion rate is a guardrail. Fraud incidents and COD returns are measured without promising improvement.
2. Confirmed means the seller accepted the order and its advance. Keep the basis of acceptance separate from the order outcome; do not equate all confirmations with an SMS match or provider verification.
3. First pilot: sellers already collecting delivery advances, with one confirmation operator per shop.
4. User clarification: received-payment information comes mainly from SMS, but the seller may manually enter transaction details observed in their payment app.

Round 2, accepted by the user on 2026-10-23 except Q6:

5. Complete, unambiguous qualifying matches automatically confirm orders without another seller click; exceptions require review. This applies to SMS and seller-entered transaction records. Criteria were refined in later rounds and are consolidated in `docs/phase-1-design.md`.
6. Every seller transaction record belongs to a specific receiving account and includes provider, TrxID and received amount. Record whether its source is SMS or manual entry. Missing essential information prevents automatic confirmation.
7. Buyer submissions are claims and do not consume transactions. Each accepted received transaction can fund only one order in Phase 1; conflicting claims require review. Split payments and one payment funding several orders are deferred.
8. Manual entry can complete the whole flow during Gemini outages; AI extraction is optional assistance.
9. User correction to Q6: collect the payment sender number separately from the buyer contact number because the payer may differ from the buyer. Matching was clarified and accepted in Round 3 (Q9).

Round 3, accepted by the user on 2026-10-23:

10. Compare the buyer-supplied payment sender number with the sender in the seller transaction record, never with the buyer contact number. Mismatched or insufficient sender information requires seller review.
11. Only the exact required advance qualifies for automatic confirmation. Underpayments and overpayments require seller review; resolution and COD adjustment rules were settled in Round 4.
12. Payments before link creation can be reviewed and accepted by the seller, but do not qualify for automatic confirmation. The full timing rule was settled in Round 8.
13. Screenshots are optional. Essential payment details are required; uploaded screenshots may assist extraction but do not change the matching rules.

Round 4, Q13-Q15 accepted by the user on 2026-10-23; Q16 accepted after clarification:

14. Sellers may explicitly accept a different advance amount and record a reason. Remaining COD is the order total minus the actual accepted payment; show the revised balance before acceptance. Payments exceeding the entire order total remain unresolved for handling outside the app. Refund and customer-credit management are outside Phase 1.
15. Manual confirmation requires a seller transaction record, including when entered from the payment app. Record reasons for exceptions; manual approval cannot bypass single-order use of a received transaction.
16. Seller SMS records may arrive before buyer submissions. Keep unmatched received transactions and attempt matching when either side arrives; unmatched does not mean invalid.

17. Q16, accepted after an example clarified that two different orders can claim one received payment: known competing claims before confirmation require seller resolution. A claim arriving after another order is confirmed remains unresolved and alerts the seller; it cannot automatically reverse the existing confirmation or reuse its payment.

Round 5, user answers on 2026-10-23:

18. Q17: user deferred the buyer-link access discussion for simplicity and future work. Do not treat the proposed buyer access policy as accepted. Seller editing authorization was separately settled in Round 6.
19. Q18: expiry applies only when the buyer has not submitted their information. Once submitted, the order never expires automatically, including while unresolved. Exact duration and submission boundary were settled in Round 6.
20. Q19: user chose seller-assisted corrections instead of buyer correction/resubmission rounds. The buyer contacts the seller with corrected details; the seller accesses the transaction portal by its designated token or the same order link, updates the information and retriggers checking. Do not adopt the previously proposed three-submission cap or buyer correction-request workflow. Authorization, audit behavior and edits after confirmation were settled in Round 6.
21. Q20: product, total price, required advance and receiving account are fixed when the link is created. A changed deal requires an explicitly replaced order; submitted or received payments require seller reconciliation rather than silent carryover.

Assumption challenged in Round 5 follow-up: wrong payment details may prevent matching, but wrong address/contact details do not necessarily prevent automatic confirmation. Payment matching is not validation of all buyer information.

These decisions refine `docs/idea.md`; `docs/phase-1-design.md` consolidates the approved shared understanding, not an implemented or validated product.

Round 6, Q21-Q23 accepted by the user on 2026-10-23, with a delivery-scope clarification:

22. Seller correction controls require authentication as the owning seller, even when opening the same URL given to the buyer. This does not reopen deferred buyer identity verification.
23. Before confirmation, relevant seller corrections retrigger payment checks. After confirmation, allow logged corrections to name, contact number and address, while accepted payment details and commercial terms stay locked. Payment reassignment requires a separate resolution process.
24. User clarification: updating a confirmed order's portal details does not update any existing delivery booking. The seller must manually restage delivery or request an update from the delivery provider. Delivery integration and its detailed workflows are deferred to the next phase.
25. An order expires 48 hours after link creation unless the server has accepted the first completed form submission. Opening or partially filling the form does not prevent expiry. After successful submission, no automatic expiry applies, including after failed matching or later corrections.

Round 7, Q24-Q25 accepted by the user on 2026-10-23; Q26 accepted after clarification:

26. Require a complete readable address reviewed by the buyer; preserve original text and allow manual correction. AI may suggest structured fields, but courier-specific location codes and mapping are deferred.
27. Sellers can explicitly cancel an order with a recorded reason. Cancellation stops automatic matching, preserves payment history, does not imply a refund, and does not automatically free an accepted payment for another order. Money-related resolution remains manual.

28. Q26, accepted after clarification: checking for two shops must be entirely separate. Match only the owning seller's records and designated receiving account; enforce single use within that seller's records. Cross-shop reuse detection and shared-account workflows are deferred. Buyer claims alone cannot reserve transactions or block other orders (Q7).
29. User explicitly reaffirmed that matching checks both TrxID and payment sender number. This reinforces Q9; it does not remove previously accepted provider, receiving-account, amount and single-use checks. Buyer contact number remains separate from payment sender number.

Round 8, Q27-Q29 accepted by the user on 2026-10-23:

30. Automatic confirmation requires a clear seller-side payment time between order creation and the buyer's payment submission. Earlier, future-dated or unclear payment times require seller review. Import time is not payment time; SMS may be pasted later.
31. Repeated identical seller transaction records do not create another payment. Conflicting records for the same transaction stop automatic matching until resolved by the seller, remain visible and cannot silently overwrite an accepted payment.
32. AI processing is optional during normal operation as well as outages. Explain what address/screenshot information goes to Gemini before the buyer chooses AI assistance. A manual-only form path remains available; routine matching uses submitted fields and seller records without an AI call.

Round 9, Q30-Q32 accepted by the user on 2026-10-23:

33. The displayed order total is the final agreed amount including delivery charges where applicable. The seller enters it; Phase 1 does not calculate courier prices or add charges afterward. Remaining COD is this total minus the accepted advance.
34. Delete uploaded screenshots and raw pasted SMS 30 days after collection, with the period explained to users. Structured transaction details and decision history are retained separately under a policy still to be settled. Original-evidence deletion must not change order state or release a used payment. Later disputes may require checking the seller's payment app again.
35. Pilot success requires repeated seller use and reduced total handling time, including link creation, SMS entry and exceptions, compared with the seller's existing workflow. Measure buyer completion too. Set a numerical time-saving target after observing baseline performance; automated tests alone do not establish success.

Round 10, Q33-Q34 accepted by the user on 2026-10-23:

36. Retain completed orders and structured payment/audit records 12 months after completion; unresolved orders remain available until seller resolution. Then remove completed-order personal details while retaining a minimal used-transaction marker while the shop is active, so deletion cannot enable reuse. Account deletion needs explicit data-removal handling before launch.
37. SMS parsing is deterministic; unrecognised or incomplete messages remain visibly unresolved and fall back to manual seller entry from the payment app. Do not send SMS to Gemini. AI assistance is limited to buyer-selected address and screenshot extraction.

## Current state

- Added `GLOSSARY.md` for settled domain meanings.
- Read-only exploration found a generic application starter, with no Phase 1 domain implementation. Existing framework: React/Vite and FastAPI; persistence and authentication are not established by configuration.
- Consolidated decisions in `docs/phase-1-design.md`; added its precedence note to `docs/idea.md`. Recorded the payment-evidence trust trade-off in `docs/adr/0001-seller-supplied-payment-evidence.md`.
- User approved shared understanding and requested a specification. The user also confirmed FastAPI as the main behavior-test seam, real PostgreSQL allocation tests and browser acceptance flows.
- Published local tracker spec at `.scratch/phase-1-order-confirmation/spec.md`, labelled `ready-for-agent`, with domain/state, API/UI and acceptance annexes. Contains 46 user stories and 50 behavioral acceptance cases. The user subsequently approved the revised vertical breakdown and requested ticket creation.
- Published 19 separate `ready-for-agent` implementation tickets under `.scratch/phase-1-order-confirmation/issues/`, preserving the approved blocking edges. Navigation and AC01-AC50 ownership are in `.scratch/phase-1-order-confirmation/ticket-index.md`. No application implementation has started.
- Open before live use: buyer-access/projection and account-deletion policies, retention for standalone unmatched structured receipts, configured provider evidence and actual rate-limit/backup handling. These gates do not imply readiness from configuration. Delivery workflows remain next-phase work.
- Evidence investigation completed: bKash PRA official templates expose payer/amount/TrxID/time placeholders but do not establish all live formats or full unmasked sender availability. Ordinary templates omit recipient account; identify it explicitly. No official Nagad template/precise uniqueness guarantee was established in bounded research. Sources and limitations are in the consolidated design.
- Next action: if implementation is requested, begin with ticket 01, then work the completed-blocker frontier. Keep the live-data/public-policy gates explicit; ticket creation alone does not authorize implementation, migration or launch.
- Resume: inspect current files and checkout changes, then continue from the latest settled round; do not treat unanswered recommendations as decisions.

## Verification

| Command or acceptance case | PASS / FAIL / BLOCKED / NOT RUN | Result or log path |
| --- | --- | --- |
| Documentation review against user answers | PASS | Rounds 1 through 10 approved; implementation spec and normative annexes written |
| PowerShell local-link existence and document-length inspection | PASS | All local links in consolidated design resolve; design 176 lines, task record below 200 lines |
| PowerShell specification validation | PASS | Four spec documents: 178/174/185/135 lines; local links resolve; no trailing whitespace; all required template sections; 46 sequential stories and 50 sequential acceptance IDs |
| Local ticket validation (Python via PowerShell) | PASS | 19 numbered ticket files; required metadata/criteria/verification; exact approved acyclic edges; local links resolve; all AC01-AC50 covered; index has 19 ticket links and 50 coverage rows; tickets below 300 lines without trailing whitespace |
| Root `npm run check` | NOT RUN | Discussion and Markdown records only; no code or tooling changes |
| Browser and live-provider behavior | NOT RUN | No implementation requested |
