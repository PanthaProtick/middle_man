# 04: Seller onboarding and workspace navigation

**What to build:** Set up a shop and navigate the seller workspace in either language without restarting the session or losing setup work.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate seller chrome, onboarding, workflow guidance, navigation, metrics, skip links, footer, loading/empty/retry states, and owned session/configuration guidance.

- [ ] Keep the shared switch available before and after authentication. Owned sign-in entry controls belong here; embedded authentication is ticket 12.

- [ ] Translate known setup/session failures using stable codes and safe fallbacks while preserving authorization and session-loading behavior.

- [ ] Switch without resetting active section/history, session, loaded records, setup inputs, pending requests, or failed-operation state. Do not repeat setup or session actions.

- [ ] Use approved terminology and accurate loaded-record metric explanations; preserve shop names, brands, identifiers, and user text.

- [ ] Extend rendered workspace/onboarding/session/navigation/metrics tests in both locales with preserved state and request-count assertions.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
