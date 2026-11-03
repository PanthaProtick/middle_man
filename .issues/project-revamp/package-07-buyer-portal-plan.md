# Package 07 — Buyer Confirmation and Status Portal

Status: Planned & ready for execution  
Date: 2026-11-02 (Asia/Dhaka)  
Parent: [Revamp implementation roadmap](implementation-roadmap.md)  
Reference: [Package 02 decisions](package-02-visual-and-interaction-decisions.md), [DESIGN.md](../../DESIGN.md), [Prototype E](../../.cache/prototypes/prototype-e-buyer-portal-validation.html)

---

## 1. Scope & Objective

Package 07 recomposes the standalone public buyer confirmation and status portal (`/orders/:token`) into the **Modern Dhaka Shop Desk** visual and interaction architecture.

The buyer portal is the single high-trust bridge between buyer and seller after agreeing to terms in social chat. The buyer arrives on mobile (typically 320px–390px viewport via Messenger/WhatsApp/Instagram in-app browser or native browser), reviews terms, copies the merchant's bKash/Nagad receiving number, provides shipping details (Pathao cascading dropdowns or manual address), and submits an advance payment claim (sender number + TrxID). After submission, the portal shifts to a high-trust status tracking view explaining the next contract step (pending review, confirmed, expired, rejected, or cancelled).

### Primary File Owners
1. `frontend/src/features/buyer/BuyerPortal.tsx`: Session coordinator, route error / access gate / loading states, switching between form and status views.
2. `frontend/src/features/buyer/BuyerOrderDetails.tsx`: Boarding-pass commercial terms, item summary, tabular advance vs COD breakdown, receiving account copy card.
3. `frontend/src/features/buyer/BuyerSubmissionForm.tsx`: 3-section structured form, form validation error focus, error summary banner, submit button.
4. `frontend/src/features/buyer/BuyerContactFields.tsx`: Section 1 - Recipient name and contact phone inputs.
5. `frontend/src/features/buyer/PathaoLocations.tsx`: Section 2 - Cascading City -> Zone -> Area courier selectors with quiet inline loading and manual address fallback.
6. `frontend/src/features/buyer/PaymentClaimFields.tsx`: Section 3 - Provider select (bKash/Nagad), claimed amount, sender phone, and TrxID.
7. `frontend/src/features/buyer/BuyerStatusView.tsx`: Boarding-pass status view for pending, confirmed, expired, rejected, and cancelled states with polling refresh.
8. `frontend/src/styles/buyer.css`: Modern Dhaka Shop Desk portal tokens, responsive geometry (44px touch targets, 46px input heights), Bengali line-height 1.7 clearance.

---

## 2. Design System & Topology Alignment

### A. Mobile-First Shell & Geometry
- **Viewport Constraints**: Optimized for 320px–440px mobile viewports while cleanly centered up to 560px on desktop (`max-width: 560px; margin: 0 auto;`).
- **Input Geometry**: Form controls (`input`, `select`, `textarea`) enforce minimum `46px` height and minimum `16px` font size (`font-size: 16px`) to prevent iOS Safari auto-zoom.
- **Touch Targets**: All buttons, copy triggers, select dropdowns, and checkboxes enforce strict minimum touch target of `44px` (`min-height: 44px`).
- **Focus Indicators**: Explicit 3px outline (`outline: 3px solid var(--primary-accent); outline-offset: 3px;`), never suppressed or replaced by subtle shadow-only rings.

### B. Boarding-Pass Commercial Terms (`BuyerOrderDetails`)
- **Shop & Product Card**: Store identity with shop name and order badge; item name highlighted in elevated surface.
- **Commercial Terms Tally**:
  - Total Bill, Required Advance (highlighted with pine teal `#146653`), Remaining COD.
  - Rendered with `tabular-nums` and `DM Mono` for money amounts (`৳X,XXX.XX`).
  - Clear distinction between "Advance to pay now" and "COD to pay upon delivery".
- **Receiving Account Card**:
  - High-trust highlighted panel (`background: #eaf4ee; border: 1px solid #b8d5c5; border-radius: 10px;`).
  - Wallet number displayed in large bold mono typography (`DM Mono`, `tabular-nums`, `18px`).
  - 44px touch-target copy button with checkmark transition and aria-live feedback ("Copied!" / "কপি হয়েছে!").
  - Factual representation: does NOT imply that copying or submitting verifies payment.
- **Deadline Indicator**: Expiry date/time displayed in Bangladesh Time (BST) with clock icon for active orders.

### C. 3-Section Structured Confirmation Form (`BuyerSubmissionForm`)
- **Numbered Badge Structure**:
  - Badge 1: Recipient Information (Name, Contact Number).
  - Badge 2: Delivery Address & Courier (Pathao City/Zone/Area dropdowns + Street Address textarea).
  - Badge 3: Advance Payment Information (Provider, Claimed Advance, Sender Number, TrxID).
- **Error Handling & Focus Management**:
  - Field errors styled with `#b33448` and subtle rose tint background.
  - `focusFirstError`: Automatically shifts keyboard/touch focus to the first invalid field upon validation or server 422 error.
  - Error summary banner displayed at the top when submission fails.
- **Cascading Courier Selection (`PathaoLocations`)**:
  - Preserves on-demand cascading fetch (City -> Zone -> Area).
  - Quiet loading banner placed directly under the active dropdown (`pathao-location-loading`), avoiding layout jitter.
  - Manual written address fallback retained for unserviced or unsupported zones.
  - Strict preservation of the retired-address-AI regression guardrail (zero AI buttons, zero image/screenshot upload inputs).
- **Submit Action**:
  - Full-width, min-height 48px, solid pine teal button (`btn btn-primary`).
  - Dynamic copy: "Submit confirmation" / "Submitting..." / "Retry submission".

### D. High-Trust Status & Tracking View (`BuyerStatusView`)
- **State Visual Semantics**:
  - **Pending** (`awaiting_buyer` -> `pending`): Amber circle with Clock icon; message explaining that the seller is reviewing payment; manual refresh button (44px min height) with spin icon and polling guidance.
  - **Confirmed**: Emerald circle with CheckCircle2 icon; message celebrating order confirmation; advance accepted breakdown; final remaining COD due at delivery.
  - **Expired**: Rose circle with AlertTriangle icon; clear notice that the 48-hour payment window passed and instruction to contact the seller.
  - **Rejected / Cancelled**: Neutral slate circle with XCircle icon; instruction to reach out in the original chat.
- **Acknowledgement Reference**: Pill badge displaying `submission_acknowledgement` (e.g., `#ACK-1042`) for easy reference with the seller.
- **COD Summary Box**: Boarding-pass tally of product, total bill, accepted advance, and remaining COD in `tabular-nums`.

---

## 3. Strict Invariants & Architectural Constraints

1. **File Line Budget**: Every single source file must strictly remain under 250 lines (hard cap 300 lines).
2. **Contract & API Invariants**:
   - Zero changes to `/api/public/orders/:token` request/response schemas or HTTP methods (`GET`, `POST`).
   - Zero mutations to `validateBuyerDraft.ts` or `submissionErrors.ts` field mappings.
   - Retain complete compatibility with `usePublicOrder.ts`, `useBuyerSubmission.ts`, and `useLocationCatalog.ts`.
3. **Localization Invariants**:
   - Both English (`en`) and Bengali (`bn`) supported flawlessly across every state.
   - Bengali script clearance enforced (`line-height: 1.7`) for all labels, conjuncts, and helper text.
   - Exact message keys preserved (`buyer.order.*`, `buyer.form.*`, `buyer.status.*`, `buyer.errors.*`, `buyer.location.*`).
4. **Test Suite Invariants**:
   - All 13 test files and 90 unit/integration tests must pass cleanly.
   - All test selectors (`[data-testid="copy-receiving-btn"]`, `.card`, input names `buyer_name`, `contact_number`, `address_raw`, `payment_provider`, `claimed_advance_bdt`, `payment_sender`, `payment_trx_id`, `pathao_city`, `pathao_zone`, `pathao_area`) preserved.
5. **Quality Floor Invariants**:
   - No layout-shifting hover transforms (`scale`).
   - No dark mode overrides (Middleman is light-only shop desk).
   - 44px min touch target on all interactive controls.
   - 16px min font size on form inputs.

---

## 4. Implementation Steps (To Execute After Compaction)

1. **Step 1: CSS Refinement (`frontend/src/styles/buyer.css`)**
   - Apply Modern Dhaka Shop Desk design system variables and tokens.
   - Define `.portal-shell`, `.card`, `.buyer-order-item`, `.buyer-payment-destination`.
   - Implement form section badges (1, 2, 3) and clean tactile dividers.
   - Enforce 44px touch target rules (`.btn`, `.form-control`, `select`, `input`, `.copy-btn`).
   - Enforce 46px input height and 16px font size on inputs, textareas, and selects.
   - Enforce `tabular-nums` for all financial metrics and phone numbers.
2. **Step 2: Polish `BuyerOrderDetails.tsx`**
   - Align commercial terms grid and shop header with boarding-pass aesthetics.
   - Enhance the payment destination card with highlighted emerald tint, mono wallet number, and 44px copy button.
   - Maintain `.card` class and existing data-testid and test selectors.
   - Verify line count remains < 200 lines.
3. **Step 3: Polish `BuyerContactFields.tsx` & `PaymentClaimFields.tsx`**
   - Enhance form-group styling, clear label typography, and accessible error message positioning.
   - Ensure inputs use 16px font size and `tabular-nums` on numbers/TrxIDs.
   - Verify line counts remain well below 200 lines.
4. **Step 4: Polish `PathaoLocations.tsx`**
   - Quiet cascading loading indicators below dropdowns.
   - Ensure 44px touch targets on clear button and select elements.
   - Maintain all required accessibility attributes (`aria-required`, `aria-invalid`, `aria-busy`).
   - Verify line count remains < 100 lines.
5. **Step 5: Polish `BuyerSubmissionForm.tsx`**
   - Refine 3-section layout with numbered badges and header titles.
   - Add error summary alert banner.
   - Ensure submit button meets 48px height with clear spinner/state text.
   - Verify line count remains < 240 lines.
6. **Step 6: Polish `BuyerStatusView.tsx` & `BuyerPortal.tsx`**
   - Enhance status banners with circular colored icons and calm typography.
   - Refine acknowledgement badge and COD summary tally box.
   - Polish loading spinner and gate alert notices in `BuyerPortal.tsx`.
   - Verify line counts remain < 200 lines.
7. **Step 7: Focused Test Suite & Root Verification Gate**
   - Run focused frontend tests: `npm run test:frontend -- src/features/buyer`.
   - Run conventions check: `npm run conventions`.
   - Run root pre-handoff gate: `npm run check`.
8. **Step 8: Update Roadmap & Git Commit**
   - Update `implementation-roadmap.md` marking 07 complete.
   - Commit changes with conventional message: `feat(buyer): complete package 07 buyer confirmation and status portal`.

## Review follow-up — 2026-11-02

- Removed inline line-height overrides from status and access/error guidance;
  address text now retains 1.7 script clearance.
- Corrected text-control focus outline offset to 3px. Buttons and checkboxes
  already receive the required 3px outline from the later theme stylesheet.
- Removed the competing 720px theme width so buyer.css owns the 560px shell.
- Focused buyer tests: 13 files, 90 tests passed.
- Root check initially failed on Windows pytest system-temp permissions;
  rerun with repository-local PYTEST_ADDOPTS --basetemp passed all gates.
  Evidence: `.cache/checks/check-ZwIl7i/result.json`.
- Browser visual acceptance and live-provider checks were not run.
