# 07: Open a buyer link with a safe public projection

**What to build:** Create an order as a verified seller and open its buyer link to view only approved public terms and status.

**Blocked by:** 02: Separate saved-link encryption from Clerk credentials; 04: Sign in and open the owning shop.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Explicit self-test policy enables legitimate token possession without buyer sign-in/OTP; unset policy and invalid tokens remain denied.
- [ ] Public responses contain approved terms/status only, excluding buyer personal data, screenshots, raw receipts, internal review reasons and private replacement information.
- [ ] Private/no-store and referrer protections apply and application logs do not record complete bearer links or personal request bodies; seller-only routes retain their authority checks.
- [ ] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Order creation/link retrieval, public policy dependency, public projection and buyer page loading.

## Verification target

Exercise seller-create to public-read via API and buyer loading UI; assert response allowlist, invalid/unconfigured policy cases and security headers.

Coverage: AC04, AC44, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Submission mutation changes, revocation/reissue and admission limits, which have separate tickets.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.
