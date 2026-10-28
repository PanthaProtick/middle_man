# 12: Embedded authentication

**What to build:** Sign in and recover access through embedded authentication in Bengali or English using the same pre-login language choice.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** reopened — live authentication acceptance failures

- [x] Use supported Clerk localization resources for reachable sign-in, verification, resend, password/alternative methods, recovery, errors, and session-expiry paths.

- [x] Verify installed resource contracts and reachable methods rather than assuming custom-resource support proves complete Bengali coverage.

- [x] Keep provider/brand names and IDs intact, retain authentication/authorization behavior, and leave the public buyer path independent of Clerk.

- [ ] Switch without signing out, resetting partial sign-in/recovery, dropping verification input, or repeating authentication/session actions. Report unsupported behavior as an acceptance gap rather than weakening the requirement.

- [x] Use existing rendered app boundaries to test observable locale selection and authentication integration. Resource parity and mocked widgets supplement but do not prove live coverage.

- [ ] Perform real-session acceptance for reachable embedded sign-in, verification, error, and recovery paths in both locales using existing authorized development access. Record unavailable credentials/configuration as a precise gap; external identity-provider sites remain outside application control. **Partially run; failures and remaining cases recorded below.**

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
  Clerk coverage or Bengali widget layout.

## Live verification — 2026-10-28

- Real local browser verification used the configured Clerk development instance
  at `http://localhost:5173/` and the existing development account. The backend
  was started with `npm run dev:backend`; frontend with `npm run dev:frontend`.
- PASS: English sign-in and forgot-password alternative-method screens render.
- PASS: Selecting Bengali before opening sign-in renders Bengali identifier,
  password, recovery-method and email-code screens; Google and account identifiers
  remain unchanged. Email-code verification completed successfully with user input.
- PASS: Authenticated development backend access loaded the existing synthetic
  shop. Switching Bengali to English preserved the signed-in workspace and data.
- FAIL: `openSignIn()` opens a modal that makes the application's external language
  switch inaccessible. The modal accessibility tree exposes only the language
  status, not either language control. Switching during partial sign-in/recovery
  therefore requires closing the modal; in-flow switching is not accepted.
- FAIL: Bengali modal still exposes English accessibility names `Close modal`
  and `Enter verification code`; verification submission also exposes `Loading`.
- NOT RUN: wrong/expired-code errors, resend completion, full password reset,
  English verification completion, session expiry, phone viewport and screen-reader
  acceptance. A password change requires user completion; no password was changed.
- Evidence: [`ticket12-live-session.png`](../../../docs/verification/localization/ticket12-live-session.png).
  No credentials or verification codes are recorded here.
- Earlier local verification on this checkout: focused Root/resource/SellerSession
  tests passed 22 tests. Full `npm run check` passed with repository-local TEMP/TMP:
  `.cache/checks/check-GWFvo5/result.json`. Initial default-temp run failed only
  on pytest Windows temp-directory permission. No application source changed.
- Next action: provide an accessible locale switch within the authentication
  surface using supported Clerk composition, cover missing accessible strings,
  then repeat interrupted-flow preservation and the remaining live acceptance.


## Fix and reverification — 2026-10-28

- Replaced `openSignIn()` with supported embedded `<SignIn routing="hash">` in
  `SellerSignIn.tsx`. Language controls and a localized home link remain outside
  the widget and reachable throughout recovery and verification. Widget identity
  is stable across locale changes; no locale key or credential copying is used.
- The modal's English close control is removed by this composition.
- Live Clerk PASS: switched both ways on the recovery screen without leaving it;
  switched both ways on email verification with three partial digits still visibly
  present and the resend countdown continuing. Document title and form copy follow
  the selected locale. Final recovery screen also checked after the last source edit.
- Evidence: the companion switch screenshot showed a live account identifier in
  the Clerk recovery surface, so it was removed from tracking and is retained only
  in ignored private evidence storage (`.evidence/verification/localization/`).
  It is not linked here; earlier Git history still contains the prior commit.
  Browser value reads redact input, so visible digits and screen continuity
  are the live evidence rather than comparisons against redacted values.
- Regression tests cover reachable switching, unchanged input node/value and focus,
  stable provider mount, and no repeated token request or modal invocation. Focused
  Root/SellerSession suite passed 21 tests.
- Final `npm run check` PASS with repository-local TEMP/TMP:
  `.cache/checks/check-U7oVIM/result.json`. Initial implementation hit the lint rule
  against synchronous effect state updates; reset now occurs in the sign-out action.
- Remaining acceptance gap: installed Clerk localization types expose no keys for
  the hardcoded `Enter verification code` and `Loading` accessibility labels. These
  remain untranslated. No generated DOM patch or unsupported localization keys were
  added. Resolving them requires Clerk support or a separately designed custom auth
  flow with equivalent methods, recovery, MFA, error and security coverage.
- Ticket remains reopened; earlier unrun phone/screen-reader, expiry/error and full
  password-reset acceptance remain open. No password was changed or order modified.

## Review-fix pass — 2026-10-28

- Branch `review-fixes-localization` (`2c96682`, `63b183f`; base `4359cea`) changed
  no Clerk contract or provider behavior and added no live coverage. It typed the
  `Root.test.tsx` Clerk localization mock as
  `Array<ClerkLocalizationResource | undefined>` instead of `as unknown[]`, so the
  locale-prop assertions stay compiler-checked. Static resource parity still does
  not prove the installed Clerk widgets render every reachable path in Bengali.
- Ticket remains reopened: the hardcoded `Enter verification code` and `Loading`
  accessibility labels are still untranslated, and the phone-browser,
  screen-reader, expiry/error and full password-reset acceptance cases remain
  unrun.
