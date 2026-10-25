# 10: Revoke buyer-link access

**What to build:** Let the owning seller revoke a buyer link through the workspace without cancelling the order.

**Blocked by:** 08: Submit once and recover an uncertain response.

**Status:** done

## Acceptance criteria

- [x] Owning-shop revocation is durable, audited, version-checked and idempotent; foreign sellers cannot invoke it.
- [x] Revocation denies public reads, writes and cached replay while preserving seller access, order lifecycle, terms and payment allocation.
- [x] A PostgreSQL submission/revocation race produces one serialized outcome; public authorization does not rely on stale state.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Order access state, typed seller action, public authorization/replay checks and seller order controls.

## Verification target

Feature action/error tests plus API access/replay/isolation cases and one independent-actor PostgreSQL race with restart verification.

Coverage: AC02, AC28, AC37–AC38, AC48 plus revocation cases. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Generating replacement tokens and changing order cancellation semantics.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

### 2026-10-25 implementation and verification

- Added additive migration `0018_buyer_link_revocation.sql` and seller-only
  `POST /api/seller/orders/{id}/revoke-link`, strict `expected_version` and required
  idempotency key. Access timestamp, version, actor audit and replay result commit
  atomically under shop-then-order locks. Order lifecycle, commercial terms,
  original deadline and accepted payment allocation remain unchanged.
- Workspace detail has a revoke control, pending state, uncertain-response retry
  with frozen payload/key, stale-version refresh guidance and revoked status.
- Public read, submission/upload replay and both assistance paths check current
  access before work. Locked authorization refreshes stale ORM identity state.
  Payment extraction also rechecks after its budget reservation releases the lock.
- Changed paths: backend `api/link_access.py`, `models/link_access.py`,
  `services/link_access.py`, `services/public_order_access.py`, `main.py`,
  `models/{entities,order}.py`, services `{buyer_service,evidence_service,
  address_assistance,payment_extraction,order_mapping}.py`, migration 0018,
  tests `test_link_revocation.py`, `test_link_revocation_postgres.py` and migration
  inventory expectations in `test_durable_postgres.py`;
  frontend seller `{BuyerLinkAccess.tsx,BuyerLinkAccess.test.tsx,
  OrderDetailModal.tsx,types.ts}`; `docs/API_CONTRACTS.md`.
- Red/green evidence: absent revoke endpoint; stale ORM authorization allowed
  revoked reads; review found extraction could read storage after reservation
  commit and intervening revocation. Each reproduced before its fix. The latter
  uses real commits and an independent revoking request with only a scheduling
  pause at the transaction boundary; storage/provider sentinels reject any work.
- Verified disposable PostgreSQL 18 target through SQL before test schema changes:
  database postgres, loopback 127.0.0.1:55447, data directory
  `E:/middle_man/.cache/resolution-pg`. Only temporary fixture schemas migrated.
  No Neon or persistent manual self-test dataset was accessed.
- Focused backend PASS: `npm run test:backend -- tests/test_link_revocation.py
  tests/test_link_revocation_postgres.py` (13 tests, including six PostgreSQL).
  Both submission/revocation orders, reconnect after clearing memory/pools,
  stale ORM state, audit rollback, and confirmed allocation preservation covered.
- Focused frontend PASS: `npm run test:frontend --
  src/features/seller/BuyerLinkAccess.test.tsx` (3 tests). Both lints and
  `npm run typecheck` PASS. Independent review: Standards 0 findings;
  Spec identified one P1 extraction race, fixed and reviewer confirmed resolved.
- Synthetic browser component PASS: disabled loading, simulated network failure,
  retry and acknowledged revoked status with pending lifecycle. Screenshot:
  `.cache/revoke-browser.png`. Temporary preview removed. This is not a real
  Clerk/Neon browser journey; those remain tickets 20–21. Reissue remains ticket 11.
- First root gate `.cache/checks/check-LsoJhg/result.json` FAIL: migration inventory
  still expected 17 migrations; other 405 backend tests passed. Updated expected
  count and consecutive prefixes to include additive migration 18. Focused
  `npm run test:backend -- tests/test_durable_postgres.py` PASS (4 tests).
- Corrected final root `npm run check` PASS, all eight stages:
  `.cache/checks/check-mv9IRq/result.json`. Backend 406 passed with the verified
  loopback PostgreSQL target enabled; tooling, both lints, backend types,
  frontend tests/build and HTTP smoke passed. No live-provider or hosted
  acceptance is claimed. Committed on current `main` branch.

## Standards

Independent review: 0 documented-standard violations or actionable smells.

## Spec

Independent review: 1 P1 extraction race found, reproduced and fixed;
reviewer confirmed 0 remaining findings. Same-order reissue is still ticket 11.
