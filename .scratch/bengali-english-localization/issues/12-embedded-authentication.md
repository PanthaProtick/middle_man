# 12: Embedded authentication

**What to build:** Sign in and recover access through embedded authentication in Bengali or English using the same pre-login language choice.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Use supported Clerk localization resources for reachable sign-in, verification, resend, password/alternative methods, recovery, errors, and session-expiry paths.

- [ ] Verify installed resource contracts and reachable methods rather than assuming custom-resource support proves complete Bengali coverage.

- [ ] Keep provider/brand names and IDs intact, retain authentication/authorization behavior, and leave the public buyer path independent of Clerk.

- [ ] Switch without signing out, resetting partial sign-in/recovery, dropping verification input, or repeating authentication/session actions. Report unsupported behavior as an acceptance gap rather than weakening the requirement.

- [ ] Use existing rendered app boundaries to test observable locale selection and authentication integration. Resource parity and mocked widgets supplement but do not prove live coverage.

- [ ] Perform real-session acceptance for reachable embedded sign-in, verification, error, and recovery paths in both locales using existing authorized development access. Record unavailable credentials/configuration as a precise gap; external identity-provider sites remain outside application control.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
