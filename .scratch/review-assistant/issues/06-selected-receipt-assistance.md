# 06: Explain a seller-selected receipt's acceptance preview

**What to build:** A seller asks for assistance with the receipt they selected
for a pending order and understands its preview exceptions and blockers without
the assistant choosing a receipt or accepting payment.

**Blocked by:** 05 — Explain all seven automatic payment review reasons.

**Status:** complete

**Implementation difficulty:** 3/5 — Medium.

**Why:** The prior assistant and existing manual preview already supply most
contracts. The main complexity is selection-bound authorization and freshness,
particularly when receipt selection or versions change during an explanation.

**Agent fit:** Agent comfortable integrating established API/UI contracts and
testing stale asynchronous selections; moderate payment-domain familiarity.

**Parent:** [Approved spec](../spec.md). Follow the [shared contract](../ticket-index.md).

- [x] Let the existing pending-order assistant use an explicitly selected receipt
  and its authorized manual acceptance preview. Do not automatically choose a
  receipt or expand into seller-wide history searches.
- [x] Explain PROVIDER_MISMATCH, TRANSACTION_ID_MISMATCH, and
  PAYMENT_EXCEEDS_TOTAL in addition to applicable existing review conditions.
  These preview conditions do not become new stored automatic review reasons.
- [x] Use provider comparison, transaction-ID comparison result, and applicable
  receipt/order amounts only; keep actual TrxIDs, account identifiers, personal
  data, and full preview records outside the outbound context.
- [x] Verify order and receipt ownership independently. Wrong-shop/nonexistent/
  retained receipts cannot expose information or invoke a provider.
- [x] Preserve hard blockers and existing acceptance validation. Advice can link
  to a corrective control but cannot submit acceptance, clear blockers, or suggest
  a prohibited bypass.
- [x] Bind output and reuse to the selected receipt, its relevant facts, order
  revision, and resolution state. Selection changes discard old advice and late
  responses; no selection keeps normal order-level assistance available.
- [x] Bengali/English UI makes the selected-preview scope clear and retains the
  existing comparison and decision controls without resetting seller drafts.
- [x] HTTP tests cover preview conditions, combined blockers, ownership, privacy,
  no mutation, and stale versions/resolutions. Rendered tests cover selection
  changes, late responses, locale, and preservation of existing decision behavior.
- [x] Run focused preview/decision/assistant/UI tests and final root `npm run check`.
  Assistance remains local; zero live Gemini requests.


## Completion record � 2026-10-30

Resumed from starting commit `e9d28e4`, preserving the stopped agent's uncommitted
prerequisite ticket 05 implementation. Both slices will be committed together
because ticket 06 depends directly on those shared model/service/UI changes.

Decisions and paths:
- `review_assistance_snapshot.py` now loads the explicitly selected receipt and
  the existing manual preview; fresh ORM reads bypass identity-map reuse.
- `review_assistance_preview.py` projects comparison results, amounts, conditions,
  and blockers into the explicit allowlist. It never sends raw preview data.
- `payment_preview.py`, `payment_preview_order.py`, and
  `payment_marker_protection.py` provide a read-only advisory path without
  key-binding initialization, expiry mutation, or shop/order row locks.
- `receipt_comparison.py` refreshes queried ORM entities for current comparisons.
- `OrderPaymentDetails.tsx` connects existing receipt selection to the assistant;
  `PaymentException.tsx` reports selection/loading/refresh/stale states without
  changing decision payloads or resetting drafts.
- `ReviewAssistant.tsx` validates selected response identity/version and discards
  late output. `SelectedPreviewAdvice.tsx` and locale `selectedPreviewCopy.ts`
  keep scope/blockers clear in both languages without locale-triggered requests.
- Model/API contracts and `docs/contracts/review-assistance.md` document the
  additive selected-preview projection, separate from automatic stored reasons.
- Added HTTP `test_review_assistance_selected.py` and rendered
  `ReviewAssistantSelected.test.tsx` regression coverage.

Checks:
- Focused backend assistant/preview/decision suite: 57 passed.
- Focused frontend assistant/selection/payment-decision suite: 36 passed.
- `npm run typecheck`: passed twice during implementation.
- Required parallel code-review skill: Standards and Spec each reported one
  issue initially; both were corrected and re-reviewed with zero remaining
  findings. Mutation regression now includes uninitialized marker-key metadata.
- Final root `npm run check`: PASS, `.cache/checks/check-Lmmk8s/result.json`.
  Earlier attempts found four import-order lint errors (fixed) and the Windows
  system-temp permission error; the passing run used repository-local TEMP/TMP.

Acceptance limits: no physical-device/live-browser or PostgreSQL concurrency
acceptance run. Generation stays local; zero live Gemini requests. Next action:
commit the verified work on the current branch; ticket 07 remains separate.
