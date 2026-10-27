# 06: Receiving accounts and payment matching

**What to build:** Configure receiving accounts, record payments, and resolve matching exceptions in either language without overstating payment certainty.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate receiving-account setup/lists, transaction inbox/filtering, manual entry, matching previews, exception blockers, loading/empty/progress, and success/failure/retry.

- [ ] Localize stable account/payment/exception reasons and server validation codes, adding narrow presentation metadata only where needed; unknown errors receive safe guidance.

- [ ] Preserve amount/sender/account/time/single-use/unresolved-evidence checks and authorization. Matching or manual acceptance must not imply independent provider verification.

- [ ] Preserve account labels, providers, phone/account numbers, TrxIDs, SMS evidence, and user text. Normalize Bengali digits only at numeric boundaries; retain precision.

- [ ] Switch with account/receipt drafts, filters, loaded evidence, pending approval, or failed decisions without losing state or repeating account/payment mutations.

- [ ] Extend rendered account/inbox/exception journeys and relevant request tests in both locales for valid/invalid input, conflicts, unmatched records, unknown codes, retained data, and no duplicate acceptance.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
