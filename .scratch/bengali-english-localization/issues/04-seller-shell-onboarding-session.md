# 04: Seller onboarding and workspace navigation

**What to build:** Set up a shop and navigate the seller workspace in either language without restarting the session or losing setup work.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** resolved

- [x] Translate seller chrome, onboarding, workflow guidance, navigation, metrics, skip links, footer, loading/empty/retry states, and owned session/configuration guidance.

- [x] Keep the shared switch available before and after authentication. Owned sign-in entry controls belong here; embedded authentication is ticket 12.

- [x] Translate known setup/session failures using stable codes and safe fallbacks while preserving authorization and session-loading behavior.

- [x] Switch without resetting active section/history, session, loaded records, setup inputs, pending requests, or failed-operation state. Do not repeat setup or session actions.

- [x] Use approved terminology and accurate loaded-record metric explanations; preserve shop names, brands, identifiers, and user text.

- [x] Extend rendered workspace/onboarding/session/navigation/metrics tests in both locales with preserved state and request-count assertions.

- [x] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Implementation record (2026-10-28)

- Implemented across commits `d99097c` and follow-ups: localized seller chrome,
  onboarding/shop setup, workflow guidance, navigation, loaded-record metrics,
  skip link/footer, and owned session/configuration guidance. Stable workspace
  and session error codes re-render in the selected language; setup conflict
  recovery, shop-name validation and session-expiry guidance were reviewed.
- Extracted `WorkspaceState`, `WorkspaceErrorBanner` and `sessionReason` to keep
  components bounded and make decoded errors presentation-independent.
- Focused seller locale/session tests passed (22 tests), workspace suites passed
  (17 tests), and `npm run typecheck` passed. Root `npm run check` passed at
  `.cache/checks/check-mUGwRm/result.json`.
- NOT RUN: physical phone, screen reader, real Clerk and hosted/provider
  acceptance. Automated checks do not establish those gates.
- Full evidence and changed paths are recorded in
  `tasks/bengali-english-localization-design.md` (Ticket 04).
