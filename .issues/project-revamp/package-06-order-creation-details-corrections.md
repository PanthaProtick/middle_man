# Package 06 — Order Creation, Details, Links, and Buyer Corrections

Status: Planned & ready for execution  
Date: 2026-11-02 (Asia/Dhaka)  
Parent: [Revamp implementation roadmap](implementation-roadmap.md)  
Reference: [Package 02 decisions](package-02-visual-and-interaction-decisions.md), [DESIGN.md](../../DESIGN.md)

---

## 1. Scope & Objective

Package 06 recomposes the seller order inspection, creation, link sharing, buyer correction, and outcome flows into the **Modern Dhaka Shop Desk** visual and interaction architecture.

### Primary Owners
1. `CreateOrderModal.tsx`: Order creation dialog, advance/COD calculator, account selector, optional early parcel fields.
2. `OrderDetailModal.tsx` & `OrderDetailModal.css`: Order detail drawer/sheet topology, sticky contextual header, 4-tab organization (`Overview`, `Payment`, `Delivery`, `Buyer & link`), keyboard navigation, assistant slot.
3. `OrderOverview.tsx`: Contextual order identity, agreed/advance/COD figures, deadlines/timestamps, developer details disclosure.
4. `OrderPaymentDetails.tsx`: Confirmed payment allocation, allocation basis, review reasons toggleable codes, immutable payment account snapshot card.
5. `BuyerLinkAccess.tsx` & `BuyerLinkCopy.tsx`: One-tap copy with failure fallback input, link revoke/reissue actions with idempotency and retry.
6. `BuyerCorrection.tsx`: Buyer revision history, editable correction draft with locked payment fields on confirmed orders, courier booking sync warning.
7. `OrderOutcomes.tsx` & `OrderOutcomeForms.tsx`: Cancel, Reject, and Replace order actions with idempotency, reason inputs, and allocation guardrails.

---

## 2. Design System & Topology Alignment

### A. Detail View Responsive Topology (`OrderDetailModal`)
- **Desktop (>1024px)**: Right-docked drawer (`width: min(600px, 100vw)` or 540px) with sticky contextual header and internal scroll.
- **Mobile (<768px)**: Full-screen modal sheet with sticky top bar and thumb-accessible bottom action bar.
- **Sticky Contextual Header**:
  - Displays Order identifier (`#ord-...`), product name, status chip, and amounts breakdown (Agreed Total, Required/Accepted Advance, Expected/Remaining COD).
  - High information scannability; amounts formatted with `tabular-nums` and `DM Mono`.
  - Alert banners for review reasons or delivery review jump directly to target tab.
- **Tabbed Architecture (4 Tabs)**:
  1. `Overview`: Core terms, timestamps (Bangladesh time), version, and developer details panel toggle.
  2. `Payment`: Allocation status, review codes, immutable merchant account card, manual payment history, assistance.
  3. `Delivery`: Parcel weight (kg) and quantity, and Pathao courier workflow.
  4. `Buyer & link`: Link copy & open actions, revoke/reissue actions, buyer correction form, and order outcomes (cancel/reject/replace).

### B. Order Creation Modal (`CreateOrderModal`)
- Modern Dhaka Shop Desk canvas and elevation (`var(--bg-card)`, `var(--border-subtle)`).
- Input geometry: Minimum `46px` input height, minimum `16px` font size (prevents iOS auto-zoom).
- Touch targets: Minimum `44px` on buttons and interactive selects.
- Tabular figures: Formatted advance vs COD calculation with high-contrast display.
- Account snapshot notice: Factual explanation that receiving account cannot be changed after creation.
- Empty accounts state: Clear guidance with alert icon and close button.
- Keyboard accessibility: Autofocus first field, Escape closes when idle, focus returns to opener on dismiss.

### C. Buyer Link & Access Controls
- `BuyerLinkCopy`: 44px min-height button, icon change (`Copy` -> `Check`), aria-live feedback ("Copied!" / "কপি হয়েছে!"), fallback copyable input on clipboard error.
- `BuyerLinkAccess`: Distinct descriptions for Revoke and Reissue, idempotent retry preservation on network timeout, 409 stale-version handling.

### D. Buyer Corrections & Outcomes
- `BuyerCorrection`:
  - Distinct state between pending and confirmed orders: payment fields disabled/locked on confirmed orders.
  - Clear courier notice: "Portal corrections do not update courier bookings".
  - Revision history disclosure.
- `OrderOutcomes`:
  - Contextual action triggers: Cancel (active non-terminal), Reject (pending unallocated), Replace (unallocated only).
  - Idempotent request payloads with expected version check.

---

## 3. Strict Invariants & Constraints

1. **File Line Budget**: Every source file must remain strictly under 250 lines (hard cap 300 lines).
2. **Behavioral Invariants**:
   - Zero changes to API contracts or request schemas.
   - Bengali/English localization parity preserved in full across all copy files.
   - All existing test assertions (exact text labels, ARIA roles, input names, error IDs) remain unbroken.
   - Tabular figures (`tabular-nums`) applied to currency, phone numbers, and TrxIDs.

---

## 4. Implementation Steps (After Compaction)

1. **Step 1: CSS Refinement (`OrderDetailModal.css`)**
   - Apply drawer and modal sheet styles using Modern Dhaka Shop Desk tokens.
   - Ensure sticky header, tabs, footer controls, and touch target constraints (44px min-height).
   - Ensure line-height 1.7 Bengali conjunct clearance and tabular numbers.
2. **Step 2: Recompose `CreateOrderModal.tsx` & `ParcelEarlyFields.tsx`**
   - Update structure to clean shop desk primitives while preserving all hook bindings from `useOrderCreation`.
   - Verify line count stays under 250 lines.
3. **Step 3: Recompose `OrderDetailModal.tsx`**
   - Implement sticky boarding-pass header with identity and amounts summary.
   - Keep tab keyboard navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`) and focus return.
   - Keep assistant slot and all tab panels.
   - Verify line count stays under 250 lines.
4. **Step 4: Recompose `OrderOverview.tsx` & `OrderPaymentDetails.tsx`**
   - Apply Modern Dhaka Shop Desk card styling, tabular numbers, and immutable snapshot card.
   - Verify line counts remain under 200 lines.
5. **Step 5: Polish `BuyerCorrection.tsx`, `BuyerLinkAccess.tsx`, `BuyerLinkCopy.tsx`, and `OrderOutcomes.tsx`**
   - Ensure 44px touch targets, 46px inputs, 16px font sizes, and consistent typography.
   - Maintain all required test selectors and error states.
6. **Step 6: Focused Test Suite & Root Gate Verification**
   - Run focused frontend tests: `CreateOrder`, `DeveloperDetailsPanel`, `OrderReconciliation`, `Buyer`, `OrderOutcomes`, `Courier`.
   - Run `npm run conventions` and root `npm run check`.
7. **Step 7: Update Roadmap & Commit**
   - Mark Package 06 complete in `implementation-roadmap.md`.
   - Git commit with an appropriate, conventional message.

---

## 5. Test Suite Verification Matrix

- `CreateOrderModal.test.tsx` (7 tests)
- `CreateOrderLocale.test.tsx` (4 tests)
- `CreateOrderParcelValidation.test.tsx` (1 test)
- `DeveloperDetailsPanel.test.tsx` (4 tests)
- `OrderReconciliation.test.tsx` (13 tests)
- `BuyerCorrection.test.tsx` (3 tests)
- `BuyerLinkAccess.test.tsx` (5 tests)
- `BuyerLinkCopy.test.tsx` (1 test)
- `OrderOutcomes.test.tsx` (3 tests)
- `CourierWorkflow.test.tsx` (1 test)
- `CourierStatusPropagation.test.tsx` (5 tests)
