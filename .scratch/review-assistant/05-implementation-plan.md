# Ticket 05 implementation plan — explain all seven automatic review reasons

Status: planned, not implemented.
Base commit: `e9d28e4` (ticket 04 complete, working tree clean at planning time).
Parent: `.scratch/review-assistant/spec.md`.
Ticket: `.scratch/review-assistant/issues/05-automatic-review-reasons.md`.

## 1. Goal

Extend the existing seller-authenticated `POST /api/seller/orders/{order_id}/review-assistance`
slice so the local, provider-free response explains all seven automatic reconciliation
reasons, combined reasons, and the existing uncoded/unknown fallback. Facts must come
from current authoritative records and the existing reconciliation rule function, not
stored labels alone. The response must include a typed, minimal provider-context
allowlist ready for ticket 07.

## 2. Existing seams to reuse

Backend:
- `backend/app/api/review_assistance.py` — existing seller route, no new endpoint.
- `backend/app/services/review_assistance.py` — order/receipt loading, eligibility,
  retention, context token, local explanation.
- `backend/app/models/review_assistance.py` — request/response/facts/action types.
- `backend/app/services/reconciliation_rules.py` — `evaluate_candidate_match`, the
  authoritative pure rule checklist. Reuse it; do not create a second matcher.
- `backend/app/services/reconciliation.py` / `reconciliation_db.py` — established
  held-claim and competing-claim behavior.
- `backend/app/services/receipt_comparison.py` — `compare_receipt` already returns
  the same-shop receipt, claims with `held_by_resolution`, allocation id, and
  resolution history. Reuse for related-claim aggregates and freshness.
- `backend/app/services/receipt_identity.py` + `compute_payment_digest` + used marker
  store — derive used/allocated state without exposing receipt identity.
- `backend/app/services/resolution_history.py` — held/rejected revision state.
- `backend/app/services/retention_access.py` — retained records remain unavailable.

Frontend:
- `frontend/src/features/seller/ReviewAssistant.tsx` — existing Ask AI button/view.
- `frontend/src/features/seller/ReviewAssistantPanel.tsx` — existing panel.
- `frontend/src/features/locale/reviewAssistanceCopy.ts` — bilingual local copy.
- `frontend/src/features/seller/reviewAssistanceApi.ts` — typed client.
- Existing rendered tests in `ReviewAssistant*.test.tsx`.

Docs:
- `docs/contracts/review-assistance.md`
- `docs/API_CONTRACTS.md` already links the contract.

## 3. Backend design

### 3.1 Condition model

Add `MULTIPLE_REVIEW_REASONS` to `ReviewCondition`. Supported condition values:

`NO_RECORDED_RECEIPT`, `UNKNOWN_CAUSE`, `UNSUPPORTED_REASON_CODE`,
`SENDER_MISMATCH`, `AMOUNT_MISMATCH`, `TIME_UNCLEAR`,
`WRONG_RECEIVING_ACCOUNT`, `CONFLICTING_RECEIPTS`, `COMPETING_CLAIMS`,
`PAYMENT_USED`, `MULTIPLE_REVIEW_REASONS`.

Add `AutomaticReviewReason` = the seven reconciliation codes.
`reason_codes` in the response means **current authoritative reasons** derived now,
not stored labels. Add `unknown_reason_present: bool` for stored codes outside the
seven.

### 3.2 Derivation precedence

1. Load the order, active buyer revision, and stored reason labels. Retain all
   existing eligibility/ownership/retention/lifecycle checks.
2. Find the matching same-shop, non-retained receipt by `provider` + cleaned
   `trx_id`, exactly as the current assistant does.
3. If no matching receipt:
   - stored unknown codes present -> `UNSUPPORTED_REASON_CODE`;
   - else if the current claim has provider/trx identity -> `NO_RECORDED_RECEIPT`;
   - else -> `UNKNOWN_CAUSE`.
4. If a matching receipt exists, call `compare_receipt` for that receipt.
   - `this_claim` = comparison claim whose `order_id` is the target order.
   - `held` = `this_claim.held_by_resolution`.
   - `active_claims` = claims with `lifecycle == "pending"` and
     `not held_by_resolution`.
   - `active_claim_count` = `len(active_claims)` (includes this claim when active).
   - If `held`: current reasons = `[COMPETING_CLAIMS]` only. This mirrors the
     established reconciliation early return for prior-resolution-held claims.
   - Else: current reasons = `evaluate_candidate_match(...)` using current order,
     active revision, receipt, allocation/marker state, and `active_claim_count`.
   - If current reasons exist: condition = the single code or
     `MULTIPLE_REVIEW_REASONS`.
   - Else if stored unknown codes exist: `UNSUPPORTED_REASON_CODE`.
   - Else: `UNKNOWN_CAUSE` (stale supported labels are not trusted).
5. `unknown_reason_present` is true whenever any stored code is outside the seven.
   If known current reasons also exist, append one generic unknown-reason sentence
   to the explanation; do not invent a remedy.

Canonical reason order for display/explanation:
`PAYMENT_USED`, `COMPETING_CLAIMS`, `CONFLICTING_RECEIPTS`,
`WRONG_RECEIVING_ACCOUNT`, `AMOUNT_MISMATCH`, `SENDER_MISMATCH`, `TIME_UNCLEAR`.

### 3.3 Facts allowlist (`ReviewFacts`)

Only applicable fields are populated; serialize with `None` values omitted.

| Field | Type | Populate when |
| --- | --- | --- |
| `has_matching_receipt` | bool (required) | always |
| `required_advance_minor` | int | AMOUNT_MISMATCH |
| `claimed_amount_minor` | int | AMOUNT_MISMATCH |
| `received_amount_minor` | int | AMOUNT_MISMATCH |
| `currency` | `"BDT"` | AMOUNT_MISMATCH |
| `sender_status` | `"missing"` / `"different"` | SENDER_MISMATCH |
| `time_status` | `"missing"` / `"before_order_creation"` / `"after_claim_submission"` | TIME_UNCLEAR |
| `receiving_account_comparison` | `"different"` | WRONG_RECEIVING_ACCOUNT |
| `conflict_categories` | list of `"amount"`, `"receiving_account"`, `"sender"`, `"time"` | CONFLICTING_RECEIPTS, only reliably derived categories |
| `active_claim_count` | int | COMPETING_CLAIMS |
| `claim_held_by_prior_resolution` | bool | COMPETING_CLAIMS |
| `payment_used` | bool | PAYMENT_USED |
| `payment_allocated` | bool | PAYMENT_USED |

Derivation details:
- `sender_status`: receipt sender canonical missing/blank -> `missing`; otherwise
  differs from the claim sender -> `different`.
- `time_status`: receipt `occurred_at` missing -> `missing`; before order
  `created_at` -> `before_order_creation`; after claim `claim_accepted_at` ->
  `after_claim_submission`.
- `receiving_account_comparison`: receipt account id differs from order account id.
- `conflict_categories`: compare observations whose `conflict_state == "conflicting"`
  against the current receipt base fields. No values, only categories.
- `payment_allocated`: allocation exists for the receipt or state is `allocated`.
- `payment_used`: used marker exists or receipt state is `used`/`allocated`.
  Pass `payment_used or payment_allocated` to `evaluate_candidate_match`.
- Never include account ids/numbers, sender numbers, timestamps, names, addresses,
  transaction ids, notes, product names, shop/order/receipt ids, or credentials.

### 3.4 Typed provider context

Add `ReviewProviderContext` (exposed as response field `context`) with exactly:

```text
condition: ReviewCondition
reason_codes: list[AutomaticReviewReason]
unknown_reason_present: bool
locale: "en" | "bn"
facts: ReviewFacts
permitted_actions: list[ReviewAction]
```

This is the explicit allowlist for ticket 07. It contains no identifiers or private
record fields. `context_token` remains opaque and may hash internal ids/facts.

### 3.5 Explanations and actions

Build localized explanations in a dedicated text module. Compose one sentence per
current reason, joined in canonical order. Combined explanations start with
`This submission has several review reasons.` (Bengali equivalent). Unknown stored
codes append one generic manual-review sentence.

Actions stay within the existing two controls:
- `CHECK_TRANSACTIONS` -> Received Payments.
- `CORRECT_BUYER_DETAILS` -> existing buyer correction tab.

Mapping:
- SENDER/AMOUNT/TIME/WRONG_ACCOUNT -> both.
- CONFLICTING_RECEIPTS / COMPETING_CLAIMS / PAYMENT_USED -> `CHECK_TRANSACTIONS`.
- NO_RECORDED_RECEIPT / UNSUPPORTED -> both.
- UNKNOWN_CAUSE -> `CHECK_TRANSACTIONS`.
- MULTIPLE -> union of reason actions, ordered `CHECK_TRANSACTIONS` then
  `CORRECT_BUYER_DETAILS`.
- `unknown_reason_present` adds both existing controls, never an approval/accept
  action or arbitrary link.

No action approves, resolves, edits, books, or mutates records. Hard blockers remain
hard blockers; the assistant is advisory only.

### 3.6 Freshness

Extend the context token inputs to cover:
- order id/version, buyer revision number, lifecycle;
- active revision id/provider/trx/claimed amount/sender/claim time;
- stored reason labels;
- matching receipt id/version/state/has_conflict/amount/account/sender/time;
- observation ids/conflict states/relevant values;
- resolution history count/latest decision/rejected revision ids;
- allocation id/state and used-marker presence;
- sorted related claim `(order_id, revision_id, lifecycle, held_by_resolution)`;
- selected receipt id/version;
- derived condition/reason codes/facts/unknown flag.
Exclude locale. A related receipt, resolution, allocation, or competing-claim change
must change the token so the current view replaces advice and requires another
explicit action click.

Before returning in DB mode, re-read the order and matching receipt/comparison
signature and raise `REVIEW_CHANGED` if anything relevant changed during context
construction. Retained records still return `RECORD_UNAVAILABLE`.

## 4. Backend file plan

- `backend/app/models/review_assistance.py`
  - add `AutomaticReviewReason`, `MULTIPLE_REVIEW_REASONS`;
  - extend `ReviewFacts` with the table above and omit-`None` serializer;
  - add `ReviewProviderContext`;
  - add `unknown_reason_present` and `context` to the response;
  - keep request `extra="forbid"`.
- New `backend/app/services/review_assistance_context.py`
  - pure derivation of current reasons, held/active facts, used/allocated state,
    conflict categories, condition, and permitted action ids;
  - no DB or provider calls.
- New `backend/app/services/review_assistance_text.py`
  - bilingual sentence composition for each reason/fallback and unknown note;
  - amount formatter using integer minor units (`BDT 2,000.00`).
- `backend/app/services/review_assistance.py`
  - expand order/revision/receipt snapshots;
  - call `compare_receipt` for the matching receipt;
  - compute used-marker presence with existing digest helpers;
  - build facts/condition/actions/explanation/provider context;
  - extend context token and final freshness recheck;
  - keep selected receipt handling unchanged (ticket 06 owns selected preview).
- `backend/app/api/review_assistance.py`
  - no new route; keep security headers and response model.
- `docs/contracts/review-assistance.md`
  - document the seven codes, combined condition, facts allowlist, context allowlist,
    precedence, held-vs-active meaning, freshness, and advisory boundary.

## 5. Frontend file plan

- `frontend/src/features/seller/reviewAssistanceApi.ts`
  - add typed `ReviewFacts`, `ReviewCondition`, `ReviewProviderContext`;
  - add `MULTIPLE_REVIEW_REASONS` and new fact fields;
  - add `isReviewAction` guard.
- `frontend/src/features/locale/reviewAssistanceCopy.ts`
  - add bilingual static fallback copy for all seven conditions and
    `MULTIPLE_REVIEW_REASONS`;
  - add localized fact labels/value labels.
- `frontend/src/features/seller/ReviewAssistant.tsx`
  - use the server explanation when `assistance.locale === current locale`;
  - use static localized copy only after a locale switch (no refetch).
- New `frontend/src/features/seller/ReviewFactsList.tsx`
  - render only present facts with localized labels and `formatBdt`/`formatCount`;
  - no private values are available to render.
- `frontend/src/features/seller/ReviewAssistantPanel.tsx`
  - include the facts list;
  - filter `suggested_actions` through `isReviewAction` so an unsupported action id
    can never become a button.
- Existing `OrderCard` / `OrderPaymentDetails` wiring stays unchanged.

## 6. Test plan

### Backend HTTP tests (new `backend/tests/test_review_assistance_reasons.py`)

Use existing `_create_test_order`, `_submit_buyer_claim`, seller identity, and memory
stores. Control `_memory_orders[order_id]["created_at"]` to make timing deterministic.

Cover:
1. Each of the seven codes individually: condition, reason codes, exact facts,
   localized explanation content, and allowed actions.
2. Sender missing vs different.
3. Time missing / before order creation / after claim submission.
4. Wrong receiving account (second same-shop account).
5. Conflicting receipts with reliable conflict category and no other mismatch.
6. Competing claims before receipt: active count 2, held false.
7. Prior-resolution-held claim: held true, active count 0, explanation distinguishes
   it from active competition.
8. Same-shop aggregation only: a foreign shop's identical claim/receipt does not
   change the count.
9. PAYMENT_USED / allocated scenario; no other order identity in response.
10. Combined reasons (e.g. sender + amount + time missing) -> condition
    `MULTIPLE_REVIEW_REASONS`, all facts, deduped ordered actions, coherent text.
11. Combined hard blockers (PAYMENT_USED + COMPETING_CLAIMS) remain blockers and
    only existing controls are offered.
12. Unknown stored code fallback; unknown + known current reason appends generic
    note without inventing a remedy.
13. Exact minimal-context projection: seed conspicuous private values in order,
    revision, receipt, and audit/notes; assert `data["context"]` equals the exact
    allowlist dict and none of the private values appear anywhere in the context
    (and not in the explanation).
14. Unchanged business records: snapshot order/revision/transactions/reasons/
    allocations/audit before and after; assert equality.
15. Freshness: related receipt version/state, resolution history, and related claim
    changes alter `context_token`; order/revision/lifecycle changes invalidate.
16. Existing unauthenticated/wrong-shop/wrong-receipt/retained/nonpending tests keep
    passing; no provider is called (there is none in this ticket).

Update existing tests:
- `test_review_assistance_api.py::test_unsupported_stored_reason_code_guidance`:
  use an unknown code (`FUTURE_REASON`) and a matching receipt, since
  `SENDER_MISMATCH` is now supported.
- Any assertions that assumed `reason_codes` are stored labels.

### Rendered tests

Extend `ReviewAssistant*.test.tsx`:
- Render each new condition in English and Bengali; assert explanation text,
  suggested action buttons, and facts labels/values.
- Combined-reasons response renders all details and only allowed action ids.
- Held-vs-active competing-claims copy renders correctly.
- A response containing an unsupported action id does not render that button.
- Locale switch still makes no request and switches copy/fact labels.
- Context-token change (related receipt/resolution change) replaces advice and
  requires another action click; late stale responses are discarded.
- No arbitrary links are introduced.

### Docs/checks

- Update `docs/contracts/review-assistance.md`.
- Run focused:
  - `npm run test:backend -- tests/test_review_assistance_api.py tests/test_review_assistance_freshness.py tests/test_review_assistance_reasons.py`
  - `npm run test:frontend -- src/features/seller/ReviewAssistant.test.tsx src/features/seller/ReviewAssistantActions.test.tsx src/features/seller/ReviewAssistantLifecycle.test.tsx`
  - `npm run typecheck`
- Final gate: root `npm run check`; report the fresh `.cache/checks/<run>/result.json`.
- Zero live Gemini calls; no provider introduced.

## 7. Risks / decisions to watch

- `reason_codes` semantics change from stored labels to current authoritative reasons.
  Document it and update the ticket-04 test. `unknown_reason_present` preserves
  honest handling of unrecognized stored codes.
- `compare_receipt` is shop-scoped and already filters held claims; do not copy its
  buyer names/sender numbers into facts or context.
- `active_claim_count` includes this claim when it is active; a held claim is excluded
  and reported through `claim_held_by_prior_resolution`.
- Used/allocated state must mirror `evaluate_candidate_match` inputs, including used
  payment markers, not just receipt `reconciliation_state`.
- Keep new files under repository size rules; split pure derivation, text, and
  orchestration rather than growing `review_assistance.py` past 300 lines.
- DB concurrency recheck may add queries; keep it bounded and provider-free.

## 8. Next action after plan approval

Implement backend models/context/text/service first, then focused HTTP tests, then
frontend types/copy/facts/panel and rendered tests, then docs and root check.
