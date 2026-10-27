# 10: Buyer corrections and order outcomes

**What to build:** Localize buyer revision history/correction and seller order
outcome actions, including rejection, replacement, and cancellation safety copy.

**Blocked by:** 01

**Status:** ready

- [ ] Localize `BuyerCorrection`, `corrections.ts` display copy, and
      `OrderOutcomes`, including revision history, review reasons, correction form,
      locked-field explanations, courier notices, retry-same-correction, reject,
      replace, and cancel flows.
- [ ] Cover pending/terminal/unavailable/expired/retry states, confirmation and
      caution copy, payment-resolution requirements before replacement, and
      allocated-order blockers. Preserve the distinction between seller acceptance
      and provider verification.
- [ ] Preserve buyer revisions, address/name/message text, reasons/actors, order
      IDs, and evidence verbatim. Stable codes become localized labels with an
      unknown-code fallback.
- [ ] Replace raw ISO revision timestamps with the shared localized date format;
      keep stored instants and locked-term behavior unchanged.
- [ ] Switching language preserves an open correction draft, selected outcome
      action, confirmation state, pending request, and failed-operation state; it
      sends no correction/rejection/replacement/cancellation request.
- [ ] Extend correction/outcome tests for both locales, preserved values,
      lifecycle assertions, and no repeated mutation on switch.
- [ ] Focused `npm run test:frontend` passes for these suites.
