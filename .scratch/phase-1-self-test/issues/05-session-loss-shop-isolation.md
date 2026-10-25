# 05: Handle session loss and reject foreign-shop access

**What to build:** Keep private seller state inaccessible after session loss and isolate every private operation between the two test identities.

**Blocked by:** 04: Sign in and open the owning shop.

**Status:** implementation complete; real two-identity Clerk/Neon acceptance pending

## Acceptance criteria

- [x] Sign-out, expiry and identity changes clear or invalidate private UI state; late responses from an earlier session cannot repopulate it.
- [ ] Two identities cannot read or mutate each other's accounts, orders, receipts, histories, corrections, decisions, evidence, exports or retention operations; responses do not leak existence.
- [x] Verifier failures preserve the unauthorized/unavailable distinction and present a recoverable state without stale private content.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Shared seller request/session lifecycle and existing private-route permission tests; inspect surfaces in bounded groups.

## Verification target

Use a compact data-driven permission matrix with existing fixtures and feature tests for sign-out/expiry/late responses; record actual two-identity isolation observations.

Coverage: AC01, AC02, AC28, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Rewriting already-correct private services; newly introduced endpoints must also carry their own isolation tests in their owning tickets.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation and offline verification recorded below.


### 2026-10-25 implementation and evidence

Base: `a42d8d828bba748523d55fe3deec44f84996616a`; implementation commit `f811d3a`, with retention-test follow-up in the next commit. User confirmed the ticket-defined frontend session/request and backend HTTP permission seams.

- Added `frontend/src/features/seller/sessionRequest.ts`: one in-memory seller request scope, invalidated on session/token transitions. Abort plus post-body scope checks reject late responses even when the transport ignores cancellation. A 401 invalidates immediately on headers; only typed `AUTH_UNAVAILABLE` 503 invalidates as a verifier outage. Storage 503 retains existing feature handling.
- Updated `SellerSession.tsx` to unmount private workspace content on authorization failure, suppress automatic stale credential reuse, and offer explicit session retry. Existing session-key remount handles identity change/sign-out. Token-refresh acquisition failure removes private content.
- Routed `api.ts`, `retentionApi.ts`, `EvidenceViewer.tsx` and `OrderExport.tsx` through this boundary. Export checks mounted lifetime before clipboard/download side effects.
- Trade-off: private responses are buffered before exposing their body so session changes during body delivery cannot leak through. This adds a body copy and delays binary presentation until complete; it fits current bounded screenshots/CSV. Cancellation does not roll back a server mutation already committed; existing idempotent retry contracts still apply.
- Added `SellerSession.test.tsx` regressions and `sessionRequest.test.ts` for failures/recovery, expiry, sign-out, identity switch, delayed body/response, binary auth failure, and non-auth 503 distinction.
- Added `backend/tests/test_shop_isolation.py`: two locally generated RSA-signed identities through the real verifier; both directions test private reads/mutations, histories, corrections, decisions, account updates, receipt resolution, evidence, link resolution and exports. Foreign and missing resource error envelopes match, excluding per-request correlation IDs. An OpenAPI-derived sweep checks every private route's 401/503 distinction and asserts a nonempty inventory.
- Retention follow-up: both identities cancel orders via HTTP, then route clocks advance 400 days. Each seller's raw cleanup removes its own screenshot (410) and structured cleanup removes exactly one own order (410). Alpha cleanup leaves Beta's screenshot/order accessible (200); Beta subsequently cleans its own data. Supplying a foreign shop ID cannot widen cleanup scope.

Verification:

- Initial red frontend test reproduced stale private content after both 401 and AUTH_UNAVAILABLE. A separate red test caught delayed clearing when 401 headers preceded a stalled body; immediate invalidation fixes it.
- `npm run typecheck`: PASS (backend 87 source files; frontend strict TypeScript).
- `npm run test:frontend -- src/features/seller/SellerSession.test.tsx src/features/seller/EvidenceViewer.test.tsx src/features/seller/OrderExport.test.tsx src/features/seller/EvidenceRetentionPanel.test.tsx src/features/seller/StructuredRetentionPanel.test.tsx`: PASS, 21 tests at that stage.
- `npm run test:frontend -- src/features/seller/sessionRequest.test.ts src/features/seller/SellerSession.test.tsx`: PASS, final 14 tests.
- `npm run test:backend -- tests/test_shop_isolation.py tests/test_seller_auth_integration.py tests/test_raw_evidence_cleanup.py tests/test_structured_retention.py`: PASS, 20 tests before strengthened retention; strengthened `tests/test_shop_isolation.py`: PASS, 3 tests.
- Full root `npm run check`, automatically run by the commit hook: PASS, `.cache/checks/check-DacWuE/result.json`. All tooling/lint/types/tests/build/HTTP smoke stages passed. The retention follow-up receives the same full gate in its commit hook.
- Independent code-review skill: Standards 0 findings; Spec 1 retention-test gap, fixed with eligible data/controlled clocks and independently re-reviewed: 0 outstanding findings.

Remaining evidence and next action:

The second checkbox remains open for actual two-owner Clerk sessions against the intended dedicated Neon development database. All observations above use offline process-memory storage and locally signed verifier fixtures; they do not prove live Clerk/Neon, durable permission behavior, hosted deployment or browser behavior. No provider credentials or private dataset were read/changed. Ticket 20 must record real sign-out/expiry/identity-switch and owning/foreign private-surface observations; durable permission evidence is still required before claiming full local synthetic self-test completion. Existing Ticket 04 likewise retains its real-session gap. New endpoints in later tickets need their own owning/foreign tests.

Final follow-up gate (2026-10-25): `npm run check` PASS, `.cache/checks/check-yX9pFi/result.json`; backend 306 passed / 67 skipped, frontend 28 files / 130 passed. Tooling, lint, strict types, build and HTTP smoke passed. Follow-up commit `d2e70a8`; working tree clean after commit. Skipped durable/PostgreSQL cases remain unverified; no live evidence is inferred from these counts.
