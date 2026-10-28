# 12: Embedded authentication

**What to build:** Sign in and recover access through embedded authentication in Bengali or English using the same pre-login language choice.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** implemented - release acceptance pending

- [x] Use supported Clerk localization resources for reachable sign-in, verification, resend, password/alternative methods, recovery, errors, and session-expiry paths.

- [x] Verify installed resource contracts and reachable methods rather than assuming custom-resource support proves complete Bengali coverage.

- [x] Keep provider/brand names and IDs intact, retain authentication/authorization behavior, and leave the public buyer path independent of Clerk.

- [x] Switch without signing out, resetting partial sign-in/recovery, dropping verification input, or repeating authentication/session actions. Report unsupported behavior as an acceptance gap rather than weakening the requirement.

- [x] Use existing rendered app boundaries to test observable locale selection and authentication integration. Resource parity and mocked widgets supplement but do not prove live coverage.

- [ ] Perform real-session acceptance for reachable embedded sign-in, verification, error, and recovery paths in both locales using existing authorized development access. Record unavailable credentials/configuration as a precise gap; external identity-provider sites remain outside application control. **Not run — see Comments.**

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details. Copy, offline font fallback, document language, and preserved focus are implemented and tested; phone wrapping/control reachability and announcements were not verified on a real phone or screen reader.

- [x] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.

## Comments

- Commit `4194a62` (merged integration tip `6d35dc0` in `499d231`).
- Changed paths: `frontend/src/main.tsx`, `frontend/src/Root.tsx`,
  `frontend/src/Root.test.tsx`,
  `frontend/src/features/locale/clerkLocalization.ts`,
  `frontend/src/features/locale/clerkLocalization.test.ts`,
  `frontend/src/features/locale/LocaleProvider.tsx`,
  `frontend/src/features/locale/context.ts`,
  `frontend/src/features/locale/LocaleProvider.test.tsx`,
  `frontend/src/App.locale.test.tsx`,
  `frontend/src/features/seller/SellerSession.test.tsx`,
  `frontend/src/features/seller/CorrectionOutcomeLocale.test.tsx`.
- One `LocaleProvider` now sits above `ClerkProvider` in `main.tsx`; the root
  chooses `localization={clerkBengaliLocalization}` for Bengali and `undefined`
  for English. Nested providers in `App`/`SellerSession` pass through the
  enclosing selection (`provided: true`), so switching locale updates Clerk's
  options without remounting the provider or re-requesting a session token.
  Public `/orders/*` still renders without Clerk.
- Bengali resource covers sign-in start, identifier/email/phone/password fields,
  continue/verify/resend, password and alternative methods, forgot/reset
  password, email/phone code and link verification, MFA, reverification,
  common errors, footer links, loading, and sign-out keys present in the
  installed Clerk types. Provider/brand names and `{{...}}` placeholders are
  preserved.
- Focused command passed 34 tests across the six locale/auth files; `npm run
  typecheck` and `npm run lint:frontend` passed. Root `npm run check` passed
  after the integration merge (`.cache/checks/check-xhIhqB/result.json`).
- Live-auth acceptance gap: no authorized Clerk development credentials or
  hosted session were available, so real Bengali/English sign-in, verification,
  recovery, error, and expiry paths were not run in a browser with live Clerk.
  Mocked rendering proves prop wiring and session preservation only, not live
  Clerk coverage or Bengali widget layout. Static resource parity does not prove
  the installed Clerk widgets render every reachable path in Bengali.
- Status is implemented with release acceptance pending, not resolved. The
  unchecked boxes above are the remaining phone-browser, screen-reader, and
  real-session gates; a review pass changed no Clerk contract or provider
  behavior and added no live coverage.
