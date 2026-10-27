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

## Sandbox connection attempt — 2026-10-27

- Seller connection returned `PATHAO_UNAVAILABLE`. A read-only external probe
  using published shared sandbox test credentials reached the sandbox
  `/aladdin/api/v1/issue-token` endpoint and received HTTP 522. Store listing
  could not run because authentication did not return a token. No booking or
  store-creation request was made; credentials/tokens were not printed or saved.
- This establishes a provider timeout during the probe, not invalid credentials,
  store availability, or a successful sandbox connection. Actual sandbox
  acceptance remains BLOCKED. Retry connect after provider recovery; if it still
  fails, capture fresh stage/status evidence rather than assuming the same cause.
- Temporary diagnostic script removed. No application changes or new root
  verification gate were needed for this read-only provider investigation.

## Acceptance checkpoint — 2026-10-27 (Ticket 12 continuation)

- Base: `486b46df3e01bdff50fd02c6c70789978278bc32`. Preserved the existing
  uncommitted sandbox-timeout note above. No application sources changed.
- Actual browser, Thorium at `http://localhost:5173`: authenticated Synthetic
  Shop A reloaded successfully. Pathao settings initially showed sandbox,
  disconnected revision 0, no merchant, a settings error, and production disabled.
  Reload-settings click failed with `coordinate input geometry is unavailable`;
  screenshot recovery failed with `window capture timed out`. Keyboard navigation
  remained usable. These are automation failures, not proof of application defects.
- Browser PASS (bounded case): created `SYNTHETIC Ticket12 notebook` using the
  seller form, with no parcel details and no connected courier. Total BDT 1,000,
  required advance BDT 200, expected COD BDT 800. Order count changed 8 to 9;
  inspector showed Awaiting Buyer, v1, and the matching amounts. Created at
  16:16 BST on October 27. This synthetic record remains for acceptance continuation.
- Buyer browser BLOCKED: opened that order's portal in a separate in-app browser;
  it displayed `Public Access Disabled` and the unsettled-access-policy message.
  `backend/app/core/public_gate.py` requires development/test, SELF_TEST_MODE and
  the explicit self_test_link_possession policy. Requested owner consent before
  changing that access boundary; no configuration or policy bypass was applied.
- Actual sandbox BLOCKED: Ticket 09 still records no verified account-owned
  sandbox credentials/store; the visible seller connection is disconnected.
  Requested current setup status without secrets. No new provider authentication,
  booking, consignment lookup or production call was attempted in this continuation.
  The earlier HTTP 522 is historical evidence, not a fresh provider measurement.
- Automated/offline PASS: `npm run check`, with repository-local PYTEST_ADDOPTS
  basetemp `.cache/pytest-ticket12-final`; `.cache/checks/check-yi3Ows/result.json`.
  All eight stages passed: tooling, backend lint/types/tests, frontend lint/tests/
  build, HTTP smoke. Backend 520 passed, 180 skipped; frontend 210 passed.
- PostgreSQL NOT RUN by this gate (180 skips). Ticket 10 records prior disposable
  PostgreSQL retention acceptance; this run does not refresh that evidence.
- Browser NOT RUN: phone/desktop viewport matrix, buyer validation/submission,
  valid locations and recovery, manual/automatic confirmation and unique drafts,
  accepted-advance exceptions, alternate sender/contact, zero COD, stale review,
  cancellation/correction, duplicate clicks, unknown recovery, external-action
  notices, cross-shop denial, public projection privacy, retention/replay workflow.
- Sandbox NOT RUN: complete connect/store/catalog/booking/persistence/restart
  journey. Production NOT RUN; no physical pickup, delivery or settlement claim.
- Independent Ticket 11 remains `ready-for-agent`; its latest checkpoint records
  restricted cleanup verification pending and actual Neon cleanup NOT EXECUTED.
  It is not a prerequisite for this acceptance journey and was not performed here.
- Ticket 12 remains incomplete. Next: resolve local buyer-policy consent and
  verified sandbox account/store availability, resume with the new synthetic order,
  then exercise the remaining browser/provider cases and retain separate evidence.
- Independent review of this evidence update: Standards 0 findings; Spec 0 findings.
  Both reviews confirm this is a partial checkpoint, not full Ticket 12 acceptance.
  `git diff --check` passed. No TDD slice was needed because no source behavior changed.

## Approved local-policy attempt — 2026-10-27

- Owner confirmed no verified sandbox account/store yet and approved enabling
  self_test_link_possession for local acceptance. Sandbox acceptance remains BLOCKED.
- Started the existing root backend wrapper with session-only SELF_TEST_MODE=true
  and PUBLIC_BUYER_ACCESS_POLICY=self_test_link_possession. No environment files,
  application sources or authentication requirements were changed.
- Startup FAILED closed: the configured database lacks courier_attempts and
  courier_reconciliations. The previous API ran with SELF_TEST_MODE=false, so it
  did not enforce this startup inventory. Buyer access was not successfully enabled.
- Read-only preflight confirmed the recorded Neon development endpoint matches,
  database neondb, schema public, writable primary; exactly those two expected
  tables are missing. Twelve orders currently exist. Safe result artifact:
  ticket12-schema-preflight.json. No database mutation was attempted.
- Existing migrations 0024_courier_submissions.sql and
  0025_courier_reconciliation.sql supply the missing schema. Requested approval
  to apply these exact migrations transactionally and verify preservation because
  this remote schema mutation exceeds the approved local configuration action.
- Restored the backend wrapper with SELF_TEST_MODE=false while approval is pending;
  startup completed and GET /api/health returned healthy. No memory fallback or
  successful buyer submission is claimed. No root check repeated for this operational
  investigation; the prior checkpoint's automated results remain the latest gates.
- Next: on migration approval, apply exact 0024/0025 to the verified development
  target with bounded locks/timeouts and preservation checks, restart self-test
  mode, then resume the synthetic order's buyer/seller browser journey. Do not
  attempt actual sandbox booking without verified account/store access.

## Migration and buyer acceptance — 2026-10-27

- Owner authorized applying exact development migrations 0024 and 0025. Applied
  both in one transaction to the recorded Neon development target, neondb/public,
  after confirming the two tables remained absent and the target was primary.
  Used a migration advisory lock, 5s lock timeout, 30s statement timeout and SHARE
  locks over existing tables. Existing table counts and deterministic row hashes
  matched before/after. Both new tables were empty. Fresh-connection SQLAlchemy
  model reads passed. Source hashes and safe counts: ticket12-migrations-result.json.
- Restarted through npm run dev:backend with session-only SELF_TEST_MODE=true,
  PUBLIC_BUYER_ACCESS_POLICY=self_test_link_possession and DEBUG=false. No saved
  environment file changed. The first browser reload still reached an old worker:
  netstat showed both old and new listeners. Confirmed worker 25152 was spawned by
  old server 27028, stopped that worker, and verified only the new listener remained.
  Buyer portal then loaded successfully. Do not infer browser readiness from a
  successful new-server startup alone when old workers retain inherited sockets.
- Actual phone browser (390x844): empty submit displayed required name, contact,
  address, sender and TrxID errors. Filled synthetic buyer/address data, with
  contact 01700000012 and different sender 01800000012. Location retry visibly
  disabled controls while loading, returned unavailable, and retained the inputs.
  Checked unsupported/needs-seller-help and submitted the written-address/payment
  fallback by keyboard. Pending Seller Review with ACK-8673D47C appeared.
- Actual desktop buyer browser (1365x900): refresh recovered the same pending
  submission, product, BDT 1,000 total / 200 required advance / 800 expected COD.
  Refresh-status control entered Checking. Buyer screen showed public terms and
  acknowledgement, without seller courier account fields. This bounded observation
  does not establish all tenant/session or API privacy acceptance cases.
- Location unavailability was observed with a disconnected shop, not an induced
  Pathao provider outage. No valid catalog/store acceptance is claimed.
- Actual authenticated seller browser recovered the buyer revision after reload,
  including the distinct contact/sender and unsupported written address. Recorded
  a synthetic T12SYN1027A receipt for BDT 250 (no occurrence time) through its UI;
  loaded payment count rose 7 to 8. Order remained pending. This prepares an
  explicit accepted-advance exception; it does not claim confirmation or COD 750.
- Native seller receipt selection could not be verified: keyboard/accessibility
  selection left Select a receipt, and screenshot capture timed out. No payment
  acceptance, confirmation, courier draft, booking or retention operation was
  attempted through an alternate API shortcut. Opened seller app in the in-app
  browser and requested owner sign-in to continue with reliable browser controls.
- Focused sandbox-adapter/retention tests: 26 passed, 0 skipped using disposable
  loopback PostgreSQL on 55447. Provider tests use simulations, not live Pathao.
  Full final root gate is being recorded separately below.
- Current unresolved scope: actual sandbox credentials/store unavailable; manual/
  automatic confirmation, accepted exception, zero COD, courier review/blockers,
  staleness, cancellation/correction, duplicate/unknown recovery, tenant denial,
  seller viewport matrix and user-facing retention remain unverified here.
  Ticket 11 cleanup remains independent and NOT EXECUTED per its recorded status.
- In-app seller session loaded as Synthetic Shop B, showing only its three orders;
  the notebook order from Shop A was absent. Requested owner switch to Shop A.
  This demonstrates separated lists, not direct cross-shop request denial.
- Saved buyer proof screenshot: ticket12-buyer-pending.png. Temporary browser
  viewport overrides were reset; buyer and seller tabs retained for continuation.
- Final root npm run check PASS: .cache/checks/check-nMDgHW/result.json,
  all eight stages; backend 700 passed, 0 skipped; frontend 210 passed.
  PostgreSQL cases used isolated disposable loopback schemas, not the Neon
  acceptance dataset. The remote migration checks above are separate evidence.
- Independent Standards review: 0 findings. Independent Spec review: 0 findings.
  No application code changed and no new TDD slice was needed. Ticket 12 remains
  incomplete; continue after owner switches the in-app seller session to Shop A.

## Seller location selection delay — 2026-10-27

- Owner's manual walkthrough established production account connection, store
  listing and saved store recovery after selecting Production again. The settings
  environment selector resets to Offline on mount; that is distinct from loss of
  saved production defaults. Production booking remains disabled; no sandbox
  acceptance or production booking was performed.
- Reported bug: selecting city/zone takes time to appear. Deterministic component
  reproduction delayed the zones response after choosing city 1; the control
  displayed an empty value instead of 1. Initial focused test failed at that exact
  assertion. Existing code discarded all lists on each city/zone selection and
  refetched cities, zones and areas sequentially before publishing any result.
- CourierReviewLocations now gives each catalog level an independent request.
  Parent lists and selected values remain visible while the child loads; no city
  refetch on zone selection, no catalog fetch on area selection. Initial selected
  hierarchies can load independently. Child controls expose loading status and
  aria-busy. Superseded/unmounted requests are aborted and late results ignored;
  failures retain valid parent choices with the existing reload-review recovery.
- Changed frontend component and new CourierReviewLocations.test.tsx. Focused
  location/review suites: 12 passed, including slow child responses, request counts,
  stale response isolation, child clearing, abort and failure behavior. Typecheck
  passed. This fixes UI feedback and request waterfalls; it does not claim faster
  live Pathao responses. Browser/live provider timing retest remains pending.
- Final npm run check PASS: .cache/checks/check-DalOh0/result.json; 520 backend
  passed, 180 PostgreSQL skipped; 213 frontend passed; all eight stages passed.
  Independent Standards and Spec reviews: 0 findings. No live provider timing
  improvement or completed browser retest is claimed by these automated gates.
