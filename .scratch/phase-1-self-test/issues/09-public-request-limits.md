# 09: Bound public request admission

**What to build:** Reject oversized or excessive public traffic predictably before buffering large bodies or doing expensive order/storage work.

**Blocked by:** 07: Open a buyer link with a safe public projection.

**Status:** completed

## Acceptance criteria

- [x] Explicit configurable body/request/upload limits cover valid and invalid tokens; oversized bodies are rejected before whole-body buffering, including requests without a trustworthy content length.
- [x] Request-rate rejection has clear retry semantics, bounded limiter state and no private/token leakage; the local scope is documented rather than advertised as distributed protection.
- [x] Existing valid manual requests and allowed image sizes continue to work with readable rejection states.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Shared public request admission, upload ingress, typed errors and client retry/error presentation.

## Verification target

Use API tests for oversized streamed requests, invalid-token traffic, throttling/recovery and ordinary valid requests; feature-test relevant error rendering.

Coverage: Ingress portion of AC11, error portion of AC45. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Hosted edge infrastructure, distributed abuse defense and a new observability platform.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

### Implementation and verification — 2026-10-25

- Added typed ASGI ingress admission in `backend/app/core/public_admission.py`, wired before routing in `backend/app/main.py`, with positive configurable settings in `backend/app/core/config.py`.
- Actual streamed bytes are counted before domain work; oversized declared lengths are rejected without reads. Ordinary requests default to 64 KiB; upload envelopes to 6 MiB (existing 5 MiB extracted-image limit remains). Invalid tokens use the same admission rules.
- Aggregate worker-local fixed-window quota defaults to 600 requests/60 seconds. State is constant-size and retains no token/client identifiers. 413 and 429 use typed private errors; 429 exposes Retry-After through CORS. Trade-offs and configuration documented in `docs/API_CONTRACTS.md`.
- Buyer UI already renders typed rejections; fixed `useBuyerSubmission.ts` to preserve an uncertain previous attempt through a later 413/429. Regression confirms frozen payload/key survive timeout, failed status reconciliation, admission rejection and final retry.
- TDD: initial stream regression failed before implementation; uncertain-retry regressions failed before the recovery fix and passed afterward.
- Focused backend: 24 passed (`test_public_admission.py`, `test_evidence_routes.py`, `test_buyer_boundaries.py`). BuyerRetry feature tests: 7 passed. Typecheck passed.
- Final `npm run check`: PASS, `.cache/checks/check-M2xGJp/result.json`; 322 backend passed / 71 skipped, 137 frontend passed; tooling, lint, strict types, build and HTTP smoke passed.
- Code review: Standards 0 findings. Spec found one uncertain-retry issue, fixed and re-reviewed; 0 remaining findings.
- Remaining limits: worker-local quota resets on restart and is shared by all buyers; no distributed protection, slow-client deadline, total concurrent-memory bound or hosted-edge validation. ASGI server transport buffering is outside this layer. Browser and live-provider checks NOT RUN; database-dependent skips remain skips.
