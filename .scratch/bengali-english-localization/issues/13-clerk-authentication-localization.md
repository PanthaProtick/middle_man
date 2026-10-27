# 13: Embedded Clerk authentication localization

**What to build:** Supply Bengali localization resources to embedded Clerk
sign-in and recovery UI, selected by the same device locale as the app.

**Blocked by:** 01, 04

**Status:** ready

- [ ] `ClerkProvider` receives a `localization` resource for Bengali and leaves the
      built-in English resource for English. Selected from the shared locale, not
      from account state.
- [ ] Cover sign-in, verification code, password/alternative methods, forgotten
      password/recovery, error, resend, and session-expiry copy for which the
      installed Clerk types expose resources. Use standard Bangladeshi Bengali and
      keep brand/provider/product names as Clerk supplies them.
- [ ] Do not add account-level language sync, change authentication behavior, or
      alter the public buyer path that bypasses Clerk.
- [ ] Add a static test that the Bengali resource is provided when Bengali is
      selected and omitted when English is selected, plus a resource-completeness
      check for the keys we supply. Mocked components cannot establish real Clerk
      coverage; record that live-session verification remains outstanding.
- [ ] Switching language does not sign the user out, reset a partially completed
      sign-in, or repeat a session request.
- [ ] Focused frontend tests and `npm run typecheck` pass.
