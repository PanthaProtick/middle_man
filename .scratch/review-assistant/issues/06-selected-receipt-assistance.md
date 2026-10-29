# 06: Explain a seller-selected receipt's acceptance preview

**What to build:** A seller asks for assistance with the receipt they selected
for a pending order and understands its preview exceptions and blockers without
the assistant choosing a receipt or accepting payment.

**Blocked by:** 05 — Explain all seven automatic payment review reasons.

**Status:** ready-for-agent

**Implementation difficulty:** 3/5 — Medium.

**Why:** The prior assistant and existing manual preview already supply most
contracts. The main complexity is selection-bound authorization and freshness,
particularly when receipt selection or versions change during an explanation.

**Agent fit:** Agent comfortable integrating established API/UI contracts and
testing stale asynchronous selections; moderate payment-domain familiarity.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [ ] Let the existing pending-order assistant use an explicitly selected receipt
  and its authorized manual acceptance preview. Do not automatically choose a
  receipt or expand into seller-wide history searches.
- [ ] Explain PROVIDER_MISMATCH, TRANSACTION_ID_MISMATCH, and
  PAYMENT_EXCEEDS_TOTAL in addition to applicable existing review conditions.
  These preview conditions do not become new stored automatic review reasons.
- [ ] Use provider comparison, transaction-ID comparison result, and applicable
  receipt/order amounts only; keep actual TrxIDs, account identifiers, personal
  data, and full preview records outside the outbound context.
- [ ] Verify order and receipt ownership independently. Wrong-shop/nonexistent/
  retained receipts cannot expose information or invoke a provider.
- [ ] Preserve hard blockers and existing acceptance validation. Advice can link
  to a corrective control but cannot submit acceptance, clear blockers, or suggest
  a prohibited bypass.
- [ ] Bind output and reuse to the selected receipt, its relevant facts, order
  revision, and resolution state. Selection changes discard old advice and late
  responses; no selection keeps normal order-level assistance available.
- [ ] Bengali/English UI makes the selected-preview scope clear and retains the
  existing comparison and decision controls without resetting seller drafts.
- [ ] HTTP tests cover preview conditions, combined blockers, ownership, privacy,
  no mutation, and stale versions/resolutions. Rendered tests cover selection
  changes, late responses, locale, and preservation of existing decision behavior.
- [ ] Run focused preview/decision/assistant/UI tests and final root `npm run check`.
  Assistance remains local; zero live Gemini requests.
