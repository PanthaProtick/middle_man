# 08: Handle changes after submission

**What to build:** A seller correcting delivery details or cancelling an order after courier submission sees an explicit requirement to resolve the booking in Pathao. The original booking snapshot and consignment remain intact, including when the change happens while submission is in flight.

**Blocked by:** 06 — Submit drafts safely through the offline courier adapter.

**Status:** ready-for-agent

- [ ] Extend the existing seller correction/cancellation workflow end to end to distinguish an unsubmitted draft from a submitting, unknown, or accepted booking attempt.
- [ ] Before reservation/submission, corrections refresh the draft and invalidate stale review, while cancellation prevents submission. Keep the ordering guarantees introduced by protected attempts.
- [ ] Once submission is in flight or accepted, retain its reviewed payload, attempt history, booking snapshot, and consignment association. Show which relevant local change requires external seller action.
- [ ] A local edit or order cancellation never claims to modify or cancel a Pathao booking and never silently triggers an amendment, cancellation, or replacement request.
- [ ] When a booking result or later reconciliation arrives after a local change, preserve the mismatch/external-action notice rather than overwriting it with a generic successful result.
- [ ] Keep an unknown attempt protected after local correction/cancellation. Resolving a local change must not erase uncertainty or create a second booking opportunity.
- [ ] Preserve accepted payment allocations, COD history, shop isolation, and existing seller delivery-correction authority. Unrelated edits should not fabricate a delivery mismatch.
- [ ] Verify API/PostgreSQL races and seller component behavior for correction/cancellation before reservation, during an attempt, after success, and before a delayed result is applied. Include replay, restart, stale requests, and cross-shop denial.
- [ ] Run focused tests and root `npm run check` as the final gate. Use the offline adapter; this ticket adds no live provider amendments or cancellation operations.
