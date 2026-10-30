# 07: Enable optional free Gemini explanations within strict limits

**What to build:** A seller explicitly requests a Gemini-written explanation for
a synthetic pending review, while strict request limits protect free quota and
local assistance remains usable when live generation cannot proceed.

**Blocked by:** 01 — Retire address AI and erase historical AI copies;
03 — Make public Gemini demonstrations permanently local;
06 — Explain a seller-selected receipt's acceptance preview.

**Status:** complete

**Implementation difficulty:** 5/5 — Very high.

**Why:** Provider generation must land together with atomic request reservation,
duplicate suppression, snapshot freshness, output validation, privacy, and useful
fallback. Partial success can exhaust quota or return advice for changed records.

**Agent fit:** Strongest available agent for async concurrency, external-service
failure boundaries, data minimization, and full-stack lifecycle integration.
Allocate a fresh context and careful review; do not trim tests to fit the budget.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [x] Live review generation is disabled by default. Require explicit manual
  enablement and configured credentials; preserve the self-test override. Private
  synthetic-data use is the supported scope, with no paid-service requirement.
- [x] Generate only after an explicit seller request through the authorized
  review interface. Use its existing typed context and permitted actions; no
  extra history fetch, model tools, browsing, chat, or mutation authority.
- [x] Capture outbound requests with a fake provider and prove the exact approved
  allowlist. Never serialize full records or disclose names, phones, addresses,
  TrxIDs, identifiers, raw SMS, notes, product text, or credentials to the model.
- [x] Validate a bounded typed response. The model cannot add action identifiers
  or URLs outside the backend-established list, relax blockers, or turn generated
  text into an executable instruction. Reject malformed/oversized responses safely.
- [x] Atomically reserve attempts before dispatch: default five live attempts per
  Asia/Dhaka calendar day across the application, at most one per minute, configurable
  shop limits within that ceiling, and five attempts per unchanged review context.
- [x] Failed and rejected provider attempts count. Disabled/fallback/reused-view
  responses consume no live attempts. Concurrent requests cannot exceed caps or
  start more than one in-flight generation for the same review.
- [x] Single-process in-memory limits and reset on restart are explicit. Keep
  metadata bounded and content-free; do not add durable counters or seven-day
  history. Do not claim knowledge of Google's account-wide remaining quota.
- [x] Use a bounded timeout and output size; handle quota/rate rejection without
  retrying automatically. Never make fallback calls to another model or provider.
- [x] Snapshot without holding order/payment locks during generation. Recheck
  relevant order, revision, receipt, resolution, eligibility, and authorization
  before delivering output; discard stale output without automatic regeneration.
- [x] Display generated versus local source and useful Bengali/English fallback
  for disabled/unconfigured/offline, busy/limited, timeout, rejected, malformed,
  and unavailable-provider cases. Existing corrective controls remain usable.
- [x] Reuse output only within the current view for unchanged authorized context;
  revalidation is provider-free. Locale changes do not generate automatically.
  Clear output on sign-out/shop/order/selection changes as established previously.
- [x] No persistent conversations, prompts, outputs, server content caches, or
  browser content storage. Logs/errors never contain payloads, generated text,
  provider exception bodies, or secrets.
- [x] Fake-provider HTTP tests deterministically cover success, exact disclosure,
  unauthorized/ineligible requests without calls, malformed responses, failures,
  duplicates/concurrency, all cap boundaries, Dhaka rollover, self-test policy,
  stale output, and no automatic retry after provider HTTP 429.
- [x] Rendered tests prove explicit generation, source/fallback status, safe links,
  duplicate-click handling, current-view reuse, locale behavior, and late-response
  rejection. Automated tests remain externally network-blocked with zero live calls.
- [x] Confirm address extraction and public demos cannot bypass the live ceiling.
  Run focused provider/assistant/quota/UI tests and final root `npm run check`.
- [x] Document manual enable/disable and limits without promising free-provider
  availability or production readiness. Do not run live verification unless the
  user separately requests it; begin with one synthetic review if requested.

## Notes

01 and 03 are real gates: introducing a bounded assistant while leaving old Gemini
callers live would not bound application usage. 02 is independent but still required
for the full parent feature. All protections belong in this first live-provider
slice, not a later hardening ticket.

## Implementation — 2026-10-30

- Baseline: `d7b5ea6c648ea1e79f160bbfcd36a2b730c53e27`. Existing deletion of
  `../05-implementation-plan.md` is unrelated and excluded from this work.
- Added explicit `generate` requests, a Gemini-only bounded HTTP transport,
  strict output validation, atomic process-local reservations, and post-provider
  ownership/context revalidation. Local requests remain provider-free.
- Daily limits are separate from lifetime unchanged-context limits. Context
  metadata is bounded at 1024 hashed entries and fails closed at capacity;
  exhausted contexts are not evicted to reopen their attempt allowance.
- UI generation uses a separate explicit button, with localized source/fallback
  status, current-view reuse, duplicate suppression, and late-response rejection.
- Owning paths: `backend/app/services/review_generation*.py`, review-assistance
  API/models, settings, `backend/tests/test_review_generation*.py`, test network
  configuration, seller ReviewAssistant/panel/API, locale generation copy,
  rendered generation tests, and `docs/contracts/review-assistance.md`.
- Focused checks: 57 backend tests and 41 rendered tests passed; subsequent URL
  regression tests passed (19 generation HTTP tests), and expanded rendered
  generation tests passed (11). Typecheck and backend/frontend lint passed.
- Two-axis code review: Standards 0 findings; Spec 1 URL-detection gap, fixed
  with regressions for arbitrary domains, protocol-relative links, custom URI
  schemes, and IP destinations (red before green).
- Final root `npm run check`: PASS (585 backend passed, 174 skipped;
  484 frontend passed; lint/types/build/conventions/HTTP smoke passed).
  Evidence: `.cache/checks/check-3E2Y9g/result.json`.
- First full gate `.cache/checks/check-6mdRA2/result.json` stopped on an
  existing Windows pytest temp-directory permission error; rerun used
  repository-local `TEMP`/`TMP` under ignored `.cache/check-temp`.
- Completion: ticket-owned paths committed on the current branch.
- No live Gemini requests, browser/device acceptance, PostgreSQL integration,
  or hosted/provider verification performed. Limits remain single-process and
  reset on restart; enablement is documented for private synthetic reviews only.
