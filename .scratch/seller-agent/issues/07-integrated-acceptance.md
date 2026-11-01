# 07: Verify and refine the complete assistant journey

**What to build:** Complete integrated desktop/mobile journeys and deliver a polished, accessible assistant with explicit evidence of what was verified.

**Blocked by:** 02: Create orders through guided conversation; 03: Record seller transactions through guided conversation; 05: Find and prioritize orders needing attention; 06: Add optional Gemini assistance within the agreed privacy boundary.

**Status:** implemented; local and synthetic browser acceptance verified; remaining manual gates listed below

- [x] Verify all four workflows through the shared window, including creation-to-search-to-review transitions without draft loss or competing assistant windows.
- [x] Refine consistent bilingual result cards, editable summaries, badges, clarification/loading/error/empty states, launcher placement, mobile layout, and restrained motion.
- [ ] Verify keyboard navigation, screen-reader semantics, focus restoration, reduced motion, and contextual review/modal interactions in actual browser/mobile viewport acceptance.
- [ ] Verify reset/sign-out/shop-switch isolation, invalidated confirmations, conflicts, lost-response recovery, truthful results, and shared dashboard membership with controlled synthetic data.
- [x] Run meaningful fake-provider integration tests and the final root verification gate. Record exact results and separate mocked/local checks from browser, storage/concurrency, and provider acceptance; do not claim unrun gates passed.
- [x] Make zero live Gemini calls during agent verification. Leave manual provider tests to the user and confirm no application request limiting was reintroduced.
- [x] Update existing design/ticket records with changed behavior, exact check results, unresolved risks, and next action. Keep feature-specific tests in their owning slices rather than deferring them all to this ticket.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.


## Integrated acceptance — 2026-11-01

Base: `b729de30362006a9374e6426d067c875e72d7df7` on `main`.

### Refinements

- Hide the redundant launcher while the shared window is open, including inside
  order details. Restore it on dismissal; Escape returns focus to the launcher
  or the selected modal tab as appropriate.
- Keep the close/header controls sticky while long drafts/results scroll.
- Use consistent bordered query and saved-result cards. Saved order/payment
  results receive keyboard focus when confirmation replaces the editable summary.
- Added an integrated rendered-UI test retaining product, total, advance, account,
  weight, and quantity through both queries and contextual review. It verifies
  that editing the resumed summary changes the one explicit submission payload.
- Regression assertions remain in the owning order/payment/workspace suites.

Changed paths: `frontend/src/features/seller/AssistantWorkspace{,.test}.tsx`,
`SellerAssistant.css`, `AssistantResult.tsx`, `AssistantIntegratedJourney.test.tsx`,
`GuidedOrderResult.tsx`, `GuidedPaymentResult.tsx`, `GuidedOrderCreation.test.tsx`,
`GuidedPaymentEntry.test.tsx`; this record and the existing design spec.

### Local evidence

- TDD: launcher regression failed before the hidden-state change; order and
  payment focus assertions both failed before the shared result-card change.
- Workspace/lifecycle focused check: 8 passed. Order/payment focused check:
  16 passed. Integrated journey: 1 passed.
- Final focused UI acceptance set: 41 passed across 9 files (workspace, draft
  lifecycle, integrated journey, attention, preparation, guided order/payment,
  payment outcomes, and fake generation).
- `npm run typecheck`: passed after both implementation clusters.
- Focused backend acceptance: 100 passed across `test_order_submissions.py`,
  `test_transaction_submissions.py`, `test_attention_query.py`,
  `test_attention_query_parity.py`, `test_delivery_preparation.py`,
  `test_review_generation.py`, `test_review_generation_privacy.py`, and
  `test_review_generation_transport.py`. This covers memory-backed HTTP recovery,
  identity conflicts, account/shop validation, shared query membership, and fake
  provider privacy/transport. It does not establish PostgreSQL concurrency.

### Actual browser evidence

Used the in-app Chromium browser against an ignored, disposable Vite harness at
`frontend/.cache/acceptance.html` on loopback. It renders the real `App` and seller
workspace with synthetic fetch responses; unexpected requests are rejected.
This is real React/browser interaction with mocked HTTP, not real authentication
or storage acceptance. No production entry point or auth bypass was added.

At the default desktop viewport (1272 × 716) and mobile viewport (390 × 844):

- Prepared mixed-language order terms with Bengali currency/digits; switched the
  conversation language to English independently of the app; exact entered values
  remained intact. No save occurred before the confirmation button.
- Traversed attention search → order modal → Payment → contextual review → guided
  workflows → preparation search → Resume draft. One shared window remained;
  all entered order terms survived. Explicit creation returned Awaiting buyer
  with the synthetic backend link and Open order/Copy link actions.
- Filled structured payment fields with an exact synthetic transaction ID and
  Bengali amount. Enter activated Record payment; the confirmed unmatched result
  received focus and explicitly disclaimed independent provider verification.
- Observed query loading, injected 503/error with Retry, and retry to zero-count
  empty results. Escape restored launcher focus; closing within order details
  restored the selected tab. Mobile screenshots confirmed the redundant launcher
  no longer overlaps the open sheet, and the close header stays visible on scroll.
- Inspected accessibility-tree names, language, selected tabs, expanded controls,
  and focused result/region nodes. This is semantic inspection, not a screen-reader
  speech session. Reduced-motion rules were inspected in CSS, not emulated.

### Remaining acceptance boundaries

- Physical mobile keyboard/safe-area behavior, actual screen-reader speech, and
  OS/browser reduced-motion preference acceptance remain NOT RUN.
- Reset/sign-out/shop-switch isolation, stale confirmations, conflicts, and lost
  responses are automated local evidence; not all were repeated in the browser.
- PostgreSQL integration/concurrency, hosted Clerk, real courier/provider behavior,
  and live Gemini remain NOT RUN. Zero live Gemini calls were made.
- No application request ceilings were added. Existing duplicate-action/in-flight
  guards remain safety mechanisms, not rate limits. Manual Gemini testing remains
  user-owned under ticket 06's private synthetic-data boundary.
- Next action: complete the remaining device/assistive-technology and storage
  acceptance before claiming unrestricted integrated acceptance.

Two-axis review against the base: Standards 0 findings; Spec 1 partial acceptance finding (actual reduced-motion browser preference remains unrun). No implementation defects or scope creep found. Keep the accessibility acceptance checkbox incomplete. Final root gate results follow below.


### Final gate

- Root `npm run check`: PASS. All nine stages passed; result
  `.cache/checks/check-1ae6wA/result.json`.
- Process-local `PYTEST_DEBUG_TEMPROOT` used `.cache/pytest-ticket07` to avoid
  Windows system-temp permission failures. No environment files were changed.
- `git diff --check`: passed. Zero live Gemini calls.
- Remaining unchecked items above are deliberately partial: automated isolation and
  recovery evidence is not a complete repeated browser matrix, and actual
  assistive-technology/reduced-motion/device acceptance remains unrun.
