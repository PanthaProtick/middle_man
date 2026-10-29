# 07: Enable optional free Gemini explanations within strict limits

**What to build:** A seller explicitly requests a Gemini-written explanation for
a synthetic pending review, while strict request limits protect free quota and
local assistance remains usable when live generation cannot proceed.

**Blocked by:** 01 — Retire address AI and erase historical AI copies;
03 — Make public Gemini demonstrations permanently local;
06 — Explain a seller-selected receipt's acceptance preview.

**Status:** ready-for-agent

**Implementation difficulty:** 5/5 — Very high.

**Why:** Provider generation must land together with atomic request reservation,
duplicate suppression, snapshot freshness, output validation, privacy, and useful
fallback. Partial success can exhaust quota or return advice for changed records.

**Agent fit:** Strongest available agent for async concurrency, external-service
failure boundaries, data minimization, and full-stack lifecycle integration.
Allocate a fresh context and careful review; do not trim tests to fit the budget.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [ ] Live review generation is disabled by default. Require explicit manual
  enablement and configured credentials; preserve the self-test override. Private
  synthetic-data use is the supported scope, with no paid-service requirement.
- [ ] Generate only after an explicit seller request through the authorized
  review interface. Use its existing typed context and permitted actions; no
  extra history fetch, model tools, browsing, chat, or mutation authority.
- [ ] Capture outbound requests with a fake provider and prove the exact approved
  allowlist. Never serialize full records or disclose names, phones, addresses,
  TrxIDs, identifiers, raw SMS, notes, product text, or credentials to the model.
- [ ] Validate a bounded typed response. The model cannot add action identifiers
  or URLs outside the backend-established list, relax blockers, or turn generated
  text into an executable instruction. Reject malformed/oversized responses safely.
- [ ] Atomically reserve attempts before dispatch: default five live attempts per
  Asia/Dhaka calendar day across the application, at most one per minute, configurable
  shop limits within that ceiling, and five attempts per unchanged review context.
- [ ] Failed and rejected provider attempts count. Disabled/fallback/reused-view
  responses consume no live attempts. Concurrent requests cannot exceed caps or
  start more than one in-flight generation for the same review.
- [ ] Single-process in-memory limits and reset on restart are explicit. Keep
  metadata bounded and content-free; do not add durable counters or seven-day
  history. Do not claim knowledge of Google's account-wide remaining quota.
- [ ] Use a bounded timeout and output size; handle quota/rate rejection without
  retrying automatically. Never make fallback calls to another model or provider.
- [ ] Snapshot without holding order/payment locks during generation. Recheck
  relevant order, revision, receipt, resolution, eligibility, and authorization
  before delivering output; discard stale output without automatic regeneration.
- [ ] Display generated versus local source and useful Bengali/English fallback
  for disabled/unconfigured/offline, busy/limited, timeout, rejected, malformed,
  and unavailable-provider cases. Existing corrective controls remain usable.
- [ ] Reuse output only within the current view for unchanged authorized context;
  revalidation is provider-free. Locale changes do not generate automatically.
  Clear output on sign-out/shop/order/selection changes as established previously.
- [ ] No persistent conversations, prompts, outputs, server content caches, or
  browser content storage. Logs/errors never contain payloads, generated text,
  provider exception bodies, or secrets.
- [ ] Fake-provider HTTP tests deterministically cover success, exact disclosure,
  unauthorized/ineligible requests without calls, malformed responses, failures,
  duplicates/concurrency, all cap boundaries, Dhaka rollover, self-test policy,
  stale output, and no automatic retry after provider HTTP 429.
- [ ] Rendered tests prove explicit generation, source/fallback status, safe links,
  duplicate-click handling, current-view reuse, locale behavior, and late-response
  rejection. Automated tests remain externally network-blocked with zero live calls.
- [ ] Confirm address extraction and public demos cannot bypass the live ceiling.
  Run focused provider/assistant/quota/UI tests and final root `npm run check`.
- [ ] Document manual enable/disable and limits without promising free-provider
  availability or production readiness. Do not run live verification unless the
  user separately requests it; begin with one synthetic review if requested.

## Notes

01 and 03 are real gates: introducing a bounded assistant while leaving old Gemini
callers live would not bound application usage. 02 is independent but still required
for the full parent feature. All protections belong in this first live-provider
slice, not a later hardening ticket.
