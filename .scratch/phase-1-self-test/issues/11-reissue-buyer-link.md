# 11: Reissue a link for the same order

**What to build:** Recover buyer access with a fresh link for the same order while permanently invalidating previous links.

**Blocked by:** 10: Revoke buyer-link access.

**Status:** complete

## Acceptance criteria

- [x] Reissue preserves order identity, commercial terms, allocation, original deadline and submission state; it cannot revive expired/cancelled/replaced orders or reopen submission.
- [x] The old token fails all public operations and the new token has only the remaining valid authority; token/access state survives restart.
- [x] Audit, stale-version rejection and same-key retries are atomic; retries do not rotate twice and older cached responses cannot reactivate superseded tokens. Cover concurrent reissue/revocation.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Order token/access state, seller reissue action, saved-link response and existing audit/idempotency conventions.

## Verification target

Feature link-copy/action tests, API preservation/replay tests and narrowly scoped PostgreSQL token-change races.

Coverage: AC04, AC31–AC38 plus reissue cases. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Order replacement, payment migration, deadline extension and online encryption-key rotation.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

### 2026-10-25 implementation and verification

- Added owning-seller `POST /api/seller/orders/{id}/reissue-link` with strict
  `{expected_version}` and existing idempotency conventions. Reuses shop/order
  locks and atomically commits token digest/encrypted saved link, access state,
  version, audit and retry record. No schema change required.
- Preserves identity, terms, deadline, submission and allocation; refuses expired,
  cancelled, replaced and overdue unsubmitted orders. Matching retries return the
  original result; rotation/revocation superseding that token returns
  `409 BUYER_LINK_SUPERSEDED`, never reactivating the token.
- Workspace offers recovery after revocation, preserves request/key after uncertain
  outcomes, disables competing actions, and updates saved copy/open links only on
  acknowledgement. Existing `BuyerLinkCopy` remounts on the new URL.
- Tracing exposed payment extraction's reservation/reload gap: reloading by ID
  allowed old-token work after reissue. A real-commit regression reproduced a
  forbidden private-storage read; reload now checks the original digest too.
- Changed paths: backend `app/{api,models,services}/link_access.py`,
  `app/services/payment_extraction.py`, tests `test_link_reissue.py`,
  `test_link_reissue_postgres.py`, `test_link_revocation_postgres.py`;
  frontend `src/features/seller/BuyerLinkAccess{,.test}.tsx`;
  `docs/API_CONTRACTS.md` and this ticket.
- Focused backend PASS: `npm run test:backend -- tests/test_link_reissue.py
  tests/test_link_reissue_postgres.py tests/test_link_revocation.py
  tests/test_link_revocation_postgres.py` — 34 tests including 15 PostgreSQL.
  Covers both race orders with retry/revocation/submission, restart via clearing
  memory and reconnecting pools, audit rollback, allocation preservation, public
  replay denial, authentication/ownership, stale versions and invalid input.
- Disposable PostgreSQL 18 target verified by SQL before fixture migrations:
  database `postgres`, `127.0.0.1:55447`, data directory
  `E:/middle_man/.cache/resolution-pg`. Only temporary isolated schemas modified;
  no Neon or persistent manual self-test dataset touched.
- Focused frontend PASS: `npm run test:frontend --
  src/features/seller/BuyerLinkAccess.test.tsx` — 4 tests. Typecheck PASS.
  Backend lint PASS; frontend lint initially rejected render-time ref access;
  explicit pending-action state fixed it and focused frontend lint/tests PASS.
- Browser component PASS using a temporary synthetic preview and simulated fetch:
  loading disables both actions, failure retains saved URL, retry request matches,
  success displays fresh URL with unchanged pending state and Copy reports success.
  Screenshot `.cache/reissue-browser.png`; temporary preview removed. This is not
  real Clerk/Neon acceptance, which remains in tickets 20–21.
- Independent code-review against starting commit `87adde6`: Standards 0 findings;
  Spec 0 findings.
- Final root `npm run check` PASS, all eight stages:
  `.cache/checks/check-zX5Te2/result.json`. Backend 427 passed with disposable
  loopback PostgreSQL enabled; frontend 141 passed across 30 files; tooling,
  both lints, strict types, production build and HTTP smoke passed. No live
  provider, hosted deployment or full synthetic journey completion is claimed.
