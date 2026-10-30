# 05: Explain all seven automatic payment review reasons

**What to build:** Sellers receive a combined local explanation and ordered,
permitted next steps for every automatic payment review reason, using only the
minimal facts needed to explain the current review.

**Blocked by:** 04 — Explain uncoded pending submissions locally.

**Status:** complete

**Implementation difficulty:** 4/5 — High.

**Why:** Reconciliation reasons interact, and competing claims can instead mean
this claim was held by a prior resolution. Context must preserve those distinctions
without disclosing related buyers or independently reimplementing matching rules.

**Agent fit:** Strong payment-domain, related-record projection, and privacy
reasoning; comfortable testing combined conditions rather than just labels.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [x] Explain SENDER_MISMATCH, AMOUNT_MISMATCH, TIME_UNCLEAR,
  WRONG_RECEIVING_ACCOUNT, CONFLICTING_RECEIPTS, COMPETING_CLAIMS, and PAYMENT_USED
  through the existing assistant interface and rendered seller view.
- [x] Derive facts from current authoritative records and established reconciliation
  rules, not stale labels alone or a second independently invented matching engine.
- [x] Distinguish sender missing/different and time missing/before creation/after
  claim submission without sending phone numbers or exact timestamps externally.
- [x] Include only applicable required/claimed/received amounts and currency,
  account comparison, reliable conflict categories, active claim counts, hold state,
  and used/allocated status as specified by the parent allowlist.
- [x] Distinguish prior-resolution-held claims from active competing claims.
  Related same-shop records contribute aggregate facts, never other buyer identities.
- [x] Explain multiple concurrent reasons coherently; suggestions stay within
  backend-established permitted actions and preserve every acceptance blocker.
- [x] Maintain the uncoded/unknown fallback from 04. All guidance remains advisory
  and makes no changes to claims, receipts, allocations, or review status.
- [x] Keep the context ready for the later fake/live provider boundary through an
  explicit typed allowlist. Exclude identifiers, names, phones, addresses, raw SMS,
  notes, product descriptions, credentials, and unrelated history.
- [x] Context freshness covers related receipt and resolution changes as well as
  the order/buyer revision; a related change invalidates current-view reuse.
- [x] HTTP tests cover each code, combined reasons, held/active claim distinctions,
  unknown codes, same-shop aggregation, unchanged business records, and an exact
  minimal-context projection seeded with conspicuous excluded private values.
- [x] Rendered bilingual tests verify explanations, suggested controls, and
  invalidation; no unsupported action or link can be introduced.
- [x] Run focused reconciliation/assistant/UI tests and final root `npm run check`.
  Generation stays local with zero live Gemini calls.

## Completion record

**Decisions**

- `reason_codes` now reports current authoritative reasons derived from live
  records; stored labels only signal `unknown_reason_present`.
- Added `MULTIPLE_REVIEW_REASONS` for combined reasons and kept every underlying
  reason and acceptance blocker visible in the ordered actions.
- `active_claim_count` counts pending, non-held claims sharing the receipt identity
  (including this claim when active); held state is reported separately.
- Derivation reuses `evaluate_candidate_match` and `compare_receipt`; no duplicate
  reconciliation engine.
- Response gained a typed `context` allowlist (condition, current reasons, unknown
  flag, locale, facts, permitted actions) for the later fake/live provider boundary.
- Only `CHECK_TRANSACTIONS` and `CORRECT_BUYER_DETAILS` are permitted suggestions;
  no approve/resolve/edit/book action is offered.
- Frontend prefers the server explanation while the response locale matches the
  active locale, then falls back to local copy plus rendered facts after a switch.

**Changed paths**

- `backend/app/models/review_assistance.py`
- `backend/app/services/review_assistance.py`
- `backend/app/services/review_assistance_context.py` (new)
- `backend/app/services/review_assistance_snapshot.py` (new)
- `backend/app/services/review_assistance_freshness.py` (new)
- `backend/app/services/review_assistance_text.py` (new)
- `backend/tests/test_review_assistance_api.py`
- `backend/tests/test_review_assistance_freshness.py`
- `backend/tests/test_review_assistance_reasons.py` (new)
- `backend/tests/test_review_assistance_context.py` (new)
- `backend/tests/review_assistance_support.py` (new)
- `frontend/src/features/seller/reviewAssistanceApi.ts`
- `frontend/src/features/seller/ReviewAssistant.tsx`
- `frontend/src/features/seller/ReviewAssistantPanel.tsx`
- `frontend/src/features/seller/ReviewFactsList.tsx` (new)
- `frontend/src/features/seller/ReviewAssistantFacts.test.tsx` (new)
- `frontend/src/features/seller/ReviewAssistantLifecycle.test.tsx`
- `frontend/src/features/locale/reviewAssistanceCopy.ts`
- `docs/contracts/review-assistance.md`

**Checks**

- `npm run test:backend -- tests/test_review_assistance_api.py tests/test_review_assistance_freshness.py tests/test_review_assistance_reasons.py tests/test_review_assistance_context.py`
  — 36 passed.
- `npm run test:frontend -- src/features/seller/ReviewAssistantFacts.test.tsx src/features/seller/ReviewAssistant.test.tsx src/features/seller/ReviewAssistantActions.test.tsx src/features/seller/ReviewAssistantLifecycle.test.tsx`
  — 29 passed.
- `npm run typecheck:backend`, `npm run lint:backend`, `npm run typecheck:frontend`,
  `npm run lint:frontend`, `npm run conventions` — passed.
- Root `npm run check` — see `.cache/checks/<run>/result.json`.

**Remaining risks**

- The fake/live provider boundary is not wired yet; `context` is the contract it
  will consume, and only local generation is exercised today.
- Freshness tokens cover order, buyer revision, receipt comparison, allocations,
  used markers, related claims, and resolution history, but a future schema change
  must extend the signature list or stale reuse could slip through.
