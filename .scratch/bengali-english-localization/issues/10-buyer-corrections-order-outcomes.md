# 10: Buyer corrections and order outcomes

**What to build:** Review buyer revisions and correct, reject, replace, or cancel an order in either language while preserving lifecycle safeguards.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate revision history, review reasons, correction forms, locked fields, courier notices, retry guidance, and rejection/replacement/cancellation confirmations.

- [ ] Cover pending/terminal/unavailable/expired/failure states, stable server field/reason codes, and safe unknown-error guidance.

- [ ] Preserve payment-resolution prerequisites, allocated-order blockers, fixed-term constraints, authorization, expiry, and provider-booking warnings.

- [ ] Preserve buyer names/addresses/messages, revisions, evidence, user-written reasons, actor identifiers, and order IDs. Localize coded labels rather than original text.

- [ ] Use approved terms and localized timestamps without changing stored instants; confirmation must not imply independently verified payment.

- [ ] Switch during drafts, selected outcomes, confirmation dialogs, pending requests, and failures without losing state or repeating mutations. Extend rendered journeys and request/replay tests in both locales, retaining lifecycle/privacy assertions.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
