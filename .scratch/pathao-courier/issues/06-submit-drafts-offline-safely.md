# 06: Submit drafts safely through the offline courier adapter

**What to build:** A seller can exercise the complete reviewed-draft submission flow against an explicitly simulated courier, with persistent attempt tracking, reliable result states, and duplicate protection before any real booking is enabled.

**Blocked by:** 05 — Review a booking-ready draft.

**Status:** ready-for-agent

- [ ] Deliver the explicit authenticated seller submission action and UI progress/result states against the offline adapter only. Identify simulated consignments/results clearly; server-side controls must keep real and production booking unavailable.
- [ ] Recheck confirmation, cancellation, review freshness, metadata readiness, store ownership, and environment before reserving an attempt. Bind the attempt to a versioned reviewed payload and stable correlation reference.
- [ ] Persist the attempt before a potential external side effect. Serialize submissions per order and enforce one booking association per order; same-key replay, new idempotency keys, repeated clicks, and concurrent requests cannot bypass an existing submitting, unknown, or booked attempt.
- [ ] Define ordering with concurrent corrections and cancellation: changes committed before reservation invalidate review; changes after the attempt is committed/in flight cannot imply the external operation was cancelled or updated. Never hold a database transaction across a provider call.
- [ ] Simulated success records a durable consignment association and booking snapshot. Definitive noncreation failures remain editable/retryable; unknown outcomes remain protected and visibly block another attempt.
- [ ] Classify timeout, interrupted in-flight work, malformed success, ambiguous server responses, accepted-but-response-lost, and provider acceptance followed by local persistence failure conservatively as unknown. Do not infer safe retry solely from an HTTP status or elapsed timeout.
- [ ] Restart recovers or protects unfinished attempt state. Changing connection/defaults, editing a draft, or sending a different idempotency key cannot silently clear a protected attempt.
- [ ] Verify the request mapping at the single courier boundary: recipient contact, complete address, selected location/store/service, explicit quantity/weight, and exact minor-unit COD conversion, including zero collection. Preserve existing overpayment rejection.
- [ ] Courier errors leave the committed confirmed order and accepted advance intact. Typed responses and UI errors contain no raw credentials or unnecessary buyer/provider payloads.
- [ ] Through API/PostgreSQL tests, cover concurrency, replay, restart, stale review, correction/cancellation ordering, persistence failure after simulated acceptance, and every failure classification. Add seller component tests for duplicate clicks, progress, success, rejection, unknown, and session loss.
- [ ] Run focused tests and root `npm run check` as the final gate. Demonstrate zero live network calls in ordinary tests and explicitly record that external provider acceptance is not established by this ticket.
