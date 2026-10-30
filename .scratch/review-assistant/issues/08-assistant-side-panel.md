# Review assistant side panel

Date: 2026-10-30
Status: complete.
Parent: [review assistant specification](../spec.md).
Baseline inspected: `72a370657476457e01a347724fba7e6756684fc5`.

## Confirmed decisions

- Ask AI opens a dedicated right-hand panel inside the application on desktop.
- The orders view stays visible and usable beside the panel.
- This is a side panel, rather than a separate browser tab.
- Both pending order cards and the order-detail Payment tab use this presentation.
- Narrow screens use a full-width assistant view with a clear Back to order control.
- The assistant retains order-specific guidance and a separate explicit Generate
  AI response action. Opening the panel loads local guidance without generation.
- Only one assistant panel is open at a time, identifying its associated order.
- An open panel follows the order opened or requested for help. Order or selected
  receipt changes clear outdated advice, load fresh local guidance, and discard
  late responses from the previous context. They never automatically generate AI.
- On desktop, order details widen to accommodate the assistant beside the order
  within the native modal boundary. The orders list uses a right-hand side panel.
- Close or Escape dismisses the assistant before any containing order dialog and
  returns focus to its trigger where available. Mobile Back to order does the same.
- Leaving Orders closes the assistant. Reopening fetches current local guidance.
- A suggested action closes the assistant and navigates to its existing corrective
  control. The seller can reopen Ask AI afterward to reassess the order.

## Existing behavior and constraints

- Canonical domain term remains Review assistant; see [glossary](../../../../GLOSSARY.md).
  Side panel describes presentation and does not introduce a new domain concept.
- Ask AI currently appears in pending order cards and the order-detail Payment tab.
- Each instance owns its own inline response and loading state. Context changes
  invalidate assistance; live generation requires a separate explicit action.
- Order details use a native modal dialog capped at 680px. A panel outside that
  dialog may be inert or obscured; placement must respect the native top layer.
- Relevant owners: `ReviewAssistant.tsx`, `ReviewAssistantPanel.tsx`,
  `OrderCard.tsx`, `OrderPaymentDetails.tsx`, and `OrderDetailModal.tsx` under
  `frontend/src/features/seller/`.
- Existing authority, privacy, freshness, and quota boundaries remain governed by
  [ADR-0007](../../../../docs/adr/0007-review-assistant-data-and-authority-boundary.md).
- This reversible presentation decision does not currently warrant another ADR.

## Acceptance cases

- Both existing entry points open the same single-panel experience; responses no
  longer expand inline within order cards or the Payment section.
- Desktop orders remain visible and usable beside the panel; order details and
  their assistant remain interactive within the modal top layer.
- At narrow widths, guidance has a readable full-width view and Back to order
  returns to the originating order without losing its form inputs or selection.
- The panel identifies the active order. Switching from A to B cannot display
  A's response under B, including when A's request completes after the switch.
- Receipt changes and relevant fact changes invalidate stale guidance. Existing
  pending-order eligibility and authorization boundaries remain enforced.
- Only the explicit Generate action can request AI generation. Opening, resizing,
  switching context, dismissing, and reopening do not generate automatically.
- Escape closes the assistant first; a subsequent Escape can close order details.
  Focus returns to an available originating control or an appropriate order control
  if that trigger no longer exists. Mobile Back preserves the parent order view.
- Leaving Orders closes the panel; reopening revalidates local guidance without
  introducing chat or saved content history.
- Suggested actions revalidate using existing safeguards, then close the panel
  and reach the corrective control. Failed revalidation retains actionable feedback.
- Loading, local failure/retry, and generation failure/fallback remain visible in
  the panel, in the selected Bengali or English locale.

## Verification plan

- Preserve existing lifecycle, generation, and selected-receipt regression coverage.
- Add focused integration coverage for both entry points, single-panel ownership,
  stale response isolation, dismissal/focus, and suggested-action navigation.
- Run focused frontend checks per behavior cluster and root `npm run check` as
  the final implementation gate.
- Verify desktop modal interactivity and narrow-screen return behavior in a real
  browser separately; mocked tests do not establish native dialog behavior.
- No live provider calls are needed for the layout change.

## Implementation and verification (2026-10-30)

- The implementation request confirmed the consolidated design. User confirmed
  Orders UI and existing ReviewAssistant UI as the test seams.
- Added Orders-scoped single-panel ownership and portal destinations for the list
  and native order dialog. Context remounts refresh local guidance while preserving
  the open panel; late responses and actions from dismissed contexts are ignored.
- Desktop keeps order controls beside guidance; narrow screens show full-width
  guidance with localized Back to order. Parent forms and selections stay mounted.
- Dismissal restores an available trigger or order control. Approved actions close
  guidance before navigating. Newer list facts refresh an open detail view.
- Focused assistant suite: 48 tests passed across the final gate (including five
  side-panel integration scenarios). Typechecking and frontend lint passed.
- Standards review: no findings. Spec review found unavailable receipt shells and
  stale eligibility after detail decisions; both fixed, reproduced in regression
  tests, and re-reviewed with no remaining findings.
- Final root `npm run check`: PASS, result
  `.cache/checks/check-KfCUsF/result.json`. All nine stages passed: backend tests
  585 passed / 174 skipped; frontend tests 489 passed across 90 files; build and
  HTTP smoke passed. PostgreSQL cases remain skipped without a configured database.
- Earlier final-gate attempt `.cache/checks/check-qS9VsN/result.json` failed on
  Windows pytest temp-directory access. Reruns used
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/assistant-pytest-final` and passed.
- Real browser, synthetic API harness: desktop list and modal placement and
  interactivity verified; 390px narrow list/modal Back and trigger focus verified;
  first Escape closes guidance and second Escape closes details. No live providers.
  Harness and screenshots are ignored under `.cache/` and `frontend/.cache/`.
- Preserve the pre-existing deletion of `../05-implementation-plan.md`.
- No implementation work remains. Physical-device and live-provider acceptance
  were not run; browser checks used synthetic responses only.
