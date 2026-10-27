# 12: Verify the complete browser and sandbox journey

**What to build:** Demonstrate the finished buyer-to-seller workflow in an actual browser and the real Pathao sandbox, with clear evidence of what passed and what remains unverified. Production booking stays disabled.

**Blocked by:** 09 — Submit protected bookings to Pathao's sandbox; 10 — Include courier data in retention cleanup.

**Status:** ready-for-agent

- [ ] Exercise actual buyer and seller screens at phone-sized and desktop viewports with keyboard-accessible loading, validation, recovery, and submission controls. Component tests and HTTP smoke are not substitutes for browser execution.
- [ ] Verify a seller can create a link before courier setup, optionally enter parcel details, and later connect an account/store and complete the draft. Verify a buyer can select valid locations and submit a detailed address and payment claim.
- [ ] Demonstrate both manual and automatic confirmation producing exactly one draft and correct remaining COD. Include accepted advance exceptions, a different payment sender/contact number, and fully paid zero collection in suitable acceptance cases.
- [ ] Exercise location loading/outage recovery, unsupported destinations, metadata blockers, stale review, pre-submission corrections/cancellation, duplicate clicks, unknown-outcome recovery, and post-booking external-action notices. Label each controlled fault as a local/adapter simulation unless actually induced in the provider.
- [ ] Complete a real sandbox journey using verified sandbox credentials/store and synthetic data: connect, load locations, create link, submit buyer data, confirm, review, submit, inspect actual consignment persistence, and recover it after refresh/restart where appropriate.
- [ ] Verify tenant/session privacy through the user-facing workflow, including another shop's denied access and no leakage of merchant secrets or private courier data to a public buyer link.
- [ ] Verify courier retention/redaction through its existing seller/maintenance workflow on disposable data. Confirm cleanup cannot resurrect private data through replay or enable duplicate booking.
- [ ] Confirm production create-order calls remain disabled and environment/store/reference separation holds. Do not create a real pickup request, claim physical delivery/settlement, or treat sandbox acceptance as production readiness.
- [ ] Run the final root `npm run check` gate against the accepted implementation and retain its result/log artifact. Fix regressions found by this acceptance slice with focused verification before repeating the final gate.
- [ ] Publish a concise acceptance record separating automated/offline, PostgreSQL, browser, actual sandbox, and production statuses. Reference the independent obsolete-Neon-data ticket's actual status without making cleanup a false prerequisite for this journey or silently claiming it completed.
- [ ] Explicitly report failed, blocked, and unrun checks. Missing sandbox access, incomplete browser coverage, or an interrupted check cannot be recorded as a pass.

## Setup troubleshooting — 2026-10-27

- Session token renewal replaced the courier form and cleared unfinished fields.
  Reproduced with `SellerSession.test.tsx`; keep a stable request identity for the
  same Clerk session and rotate its bearer in `sessionRequest.ts`. Regression
  coverage retains form identity, input/focus, latest authorization and pending
  reads, while preserving sign-out/session-change isolation.
- A separate reload-time shop `401` initially remained unresolved. Retry seller session
  succeeds according to the user. Sign in incorrectly opened Clerk while the
  application stayed blocked; it now invokes session recovery when Clerk already
  considers the user signed in. This branch has a red/green regression test.
- Forcing a fresh startup token did not fix the actual browser reload; the
  Network view showed a successful skip-cache token request followed by shop
  `401`. Removed that speculative change and its cache-specific test. Do not
  attribute the initial rejection to stale cache. Need the failed shop response's
  safe error message to distinguish validity timing from other verifier failures.
- Browser AX observation confirmed the remaining startup failure. Screenshot
  capture timed out and element clicking failed because coordinate geometry was
  unavailable, preventing direct inspection of the failed response.
- Earlier full gate after renewal fix: `.cache/checks/check-n7ASF9/result.json`
  PASS (504 backend passed, 180 skipped; 206 frontend passed). Backend pytest
  requires repository-local `--basetemp` because the host temp directory denied
  access. These automated results do not establish browser/sandbox acceptance.
- Safe response-header diagnostics exposed the actual browser rejection as
  `not_yet_valid`. The UI reads only allowlisted categories before aborting the
  session; it never copies token/claim values. Backend response and frontend
  stalled-body/unknown-header tests cover this boundary.
- The verifier had no `nbf` clock-skew allowance. Added a fixed five-second
  `nbf` tolerance, matching Clerk's documented 5000ms clock-skew window:
  https://clerk.com/docs/reference/backend/verify-token . Expiration remains
  strict; signature, issuer, audience, origin and malformed-claim checks remain.
  Signed-token tests cover the exact five-second boundary, values beyond it,
  malformed claims and expiration. Focused backend suites: 40 passed.
- Final root `npm run check`: PASS,
  `.cache/checks/check-BGFU2i/result.json`: 520 backend passed, 180 skipped;
  210 frontend passed; tooling, lint, strict types, build and HTTP smoke passed.
  Skipped PostgreSQL coverage was not established by this run.
- Actual browser reload after the fix: shop requests returned 200 and the
  authenticated synthetic shop workspace appeared without clicking Retry.
  This verifies startup recovery only, not the complete Ticket 12 journey.
- Next: resume Pathao sandbox connection. No sandbox booking acceptance is claimed.
