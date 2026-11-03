# Package 10 — General Assistant and Contextual Review Assistance

Status: Planned & ready for execution (Awaiting Compaction)  
Date: 2026-11-03 (Asia/Dhaka)  
Parent: [Revamp implementation roadmap](implementation-roadmap.md)  
Reference: [Package 02 decisions](package-02-visual-and-interaction-decisions.md), [DESIGN.md](../../DESIGN.md), [PRODUCT.md](../../PRODUCT.md)

---

## 1. Scope & Objectives

Package 10 recomposes both the **General Assistant** (`AssistantWindow`, `GuidedAssistant`, guided order/payment forms) and the **Contextual Review Assistant** (`ReviewAssistant`, `ReviewAssistantPanel`, facts list, selected preview) into the **Modern Dhaka Shop Desk** design system.

### Key Deliverables
1. **Unified Geometry & Modern Dhaka Shop Desk Surfaces**:
   - Clean light-theme surfaces (`#ffffff` card background, `#f5f6f2` desk canvas, `#d8e2dd` tactile borders).
   - Eradicate legacy dark-mode inline styles (`color: #f8fafc`, `border: rgba(56, 189, 248, 0.25)`, etc.) from `ReviewAssistantPanel.tsx`.
   - Unified panel geometry across floating desktop window (docked bottom-right 400px card), modal drawer integration (`OrderDetailModal`), and mobile bottom sheet (<=800px down to 320px).
2. **Clear Separation of Local System vs. Gemini Advisory Notes**:
   - Distinct semantic badges: Local deterministic rules (`#eaf4ee` background, `#146653` deep pine teal text, `#b8d5c5` border) vs. Gemini AI generated advice (`#fdf6ea` background, `#8a570b` amber text, `#e8cda2` border).
   - Clear advisory notice styling indicating advisory-only status.
3. **Rigorous Sizing & Accessibility Standards**:
   - Minimum `44px` touch targets on all buttons, triggers, tabs, and selects (`min-height: 44px`).
   - Minimum `46px` input height and `16px` font size on all text/number/datetime inputs to prevent iOS auto-zoom.
   - `DM Mono` and `tabular-nums` applied to currency amounts (BDT), TrxIDs, phone numbers, and record counts.
   - Bengali script clearance (`line-height: 1.7` for `lang="bn"`).
4. **Preserved Invariants & Guardrails**:
   - **No Mutation from Model Prose**: Model generated text is never an authoritative mutation target.
   - **Explicit Confirmation**: Create order and Record payment require deliberate seller button clicks.
   - **Idempotency & Same-Key Recovery**: Idempotency keys (`storage_epoch.uuid`) preserved through `check` and `retry` states.
   - **Transient Lifetime**: Drafts and conversations exist only in memory, never leaked to persistent storage, and reset on shop/session switch.
   - **Focus & Keyboard Navigation**: Escape key dismisses panel and restores focus to the invoking trigger; keyboard navigation inside modals and sheets locks background scroll without traps.

---

## 2. Component Refactoring & Style Plan

### A. `ReviewAssistantPanel.tsx` (Currently 206 lines)
- **Problem**: Contains legacy inline styles with dark-mode colors (`background: 'var(--bg-card)'`, `color: 'var(--text-primary, #f8fafc)'`, `border: '1px solid rgba(56, 189, 248, 0.25)'`, etc.) and non-compliant touch targets (`padding: '4px 8px'`).
- **Refactoring**:
  - Extract all inline styles into clean CSS classes in `ReviewAssistantSidePanel.css`.
  - `.review-assistant-panel`: Modern Dhaka Shop Desk surface (`background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px;`).
  - `.review-guidance-badge`:
    - Local rule: `.review-guidance-badge--local` (`background: #eaf4ee; color: #146653; border: 1px solid #b8d5c5; font-weight: 600; font-size: 0.75rem; border-radius: 9999px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;`).
    - Gemini generated: `.review-guidance-badge--generated` (`background: #fdf6ea; color: #8a570b; border: 1px solid #e8cda2;`).
  - `.review-assistance-explanation`: Crisp ink typography (`color: var(--text-primary); font-size: 0.9rem; line-height: 1.5;`).
  - `.review-action-button`: `.btn-secondary` with `min-height: 44px; padding: 8px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;`.
  - `.review-advisory-note`: Italicized slate text (`color: var(--text-muted); font-size: 0.775rem; border-top: 1px solid var(--border-subtle); padding-top: 10px; margin-top: 12px;`).

### B. `ReviewAssistantSidePanel.css` (Currently 75 lines)
- Upgrade layout rules:
  - Add classes for `ReviewAssistantPanel` elements.
  - Desktop: Docked right column (`minmax(320px, 400px)`), smooth border, zero horizontal overflow.
  - Mobile (<=800px): Bottom sheet taking full width, sticky header with back button (`.assistant-back`, min-height 44px), scroll containment (`overscroll-behavior: contain`).
  - Keep within 160 lines (well under 250 line soft cap).

### C. `SellerAssistant.css` (Currently 141 lines)
- Upgrade general assistant layout rules:
  - `.seller-assistant-launcher`: Modern Dhaka Shop Desk primary button (`#146653`), floating bottom-right (`right: 20px; bottom: 20px; min-height: 44px; padding: 10px 18px; border-radius: 9999px; box-shadow: 0 4px 16px rgba(20, 102, 83, 0.25); font-weight: 600;`).
  - `.seller-assistant-workspace .assistant-slot:has(.seller-assistant-window, .review-assistant-side-panel)`:
    - Desktop: Elevated card (`width: min(420px, calc(100vw - 40px)); max-height: 75dvh; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 14px; box-shadow: 0 12px 36px rgba(20, 102, 83, 0.12), 0 2px 6px rgba(0,0,0,0.06);`).
    - Mobile (<=800px): Bottom sheet (`inset: auto 0 0; width: 100%; max-height: calc(100dvh - 56px); border-radius: 16px 16px 0 0; padding-bottom: max(16px, env(safe-area-inset-bottom));`).
  - Typography & Inputs:
    - `.seller-assistant-window :is(input, textarea, select)`: `min-height: 46px; font-size: 16px; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 12px; background: #ffffff; color: var(--text-primary);`.
    - Bengali script clearance: `:lang(bn) { line-height: 1.7; }`.
    - `tabular-nums` for numerical inputs and currency displays.
  - Keep within 220 lines (under 250 soft cap).

### D. `AssistantWindow.tsx` (Currently 51 lines)
- Modernize header, language selector, and navigation buttons:
  - Header: Sticky top bar with shop desk typography and 44px touch targets.
  - Context buttons: Segmented style (`General`, `New Chat`) with `aria-pressed`.
  - Context status badge: Factual indicator (`General Assistant` vs `Reviewing Order #...`).

### E. `GuidedOrderFields.tsx` & `GuidedPaymentFields.tsx` (52 lines & 61 lines)
- Boarding-pass summary card:
  - Highlighted summary box (`background: #eaf4ee; border: 1px solid #b8d5c5; border-radius: 10px; padding: 14px;`).
  - Tally breakdown (Total, Advance, Remaining COD) in `DM Mono` with `tabular-nums`.
  - Account selection with active badge and 44px refresh button.
  - Explicit primary confirmation button (`Create order` / `Record payment`) meeting 44px min-height.
  - Distinct status messages for `processing`, `unknown`, `conflict`, `retry`, `failed`.

### F. `AttentionPreview.tsx` & `PreparationPreview.tsx` (82 lines & 77 lines)
- Boarding-pass preview cards:
  - Clean card item styling with order ID, category badge, and 44px action buttons.
  - Tabular timestamps and order counts.
  - One-tap reference copy with aria-live confirmation.

### G. `AssistantDiscardPrompt.tsx` (19 lines)
- Alertdialog with 44px touch-target action buttons (`Resume`, `Discard`, `Cancel`), high-contrast warning copy.

---

## 3. Strict File Size Budget

| File | Current Lines | Target Lines | Status |
|------|---------------|--------------|--------|
| `ReviewAssistantPanel.tsx` | 206 | ~190 | Well under 250 soft cap |
| `ReviewAssistantSidePanel.css` | 75 | ~140 | Well under 250 soft cap |
| `SellerAssistant.css` | 141 | ~200 | Well under 250 soft cap |
| `AssistantWindow.tsx` | 51 | ~55 | Well under 250 soft cap |
| `GuidedOrderFields.tsx` | 52 | ~58 | Well under 250 soft cap |
| `GuidedPaymentFields.tsx` | 61 | ~68 | Well under 250 soft cap |
| `AttentionPreview.tsx` | 82 | ~85 | Well under 250 soft cap |
| `PreparationPreview.tsx` | 77 | ~80 | Well under 250 soft cap |
| `AssistantDiscardPrompt.tsx` | 19 | ~22 | Well under 250 soft cap |
| `AssistantWorkspace.tsx` | 88 | ~90 | Well under 250 soft cap |

*All files maintain the strict <250 physical lines soft cap (300 maximum).*

---

## 4. Verification & Testing Strategy

1. **Focused Frontend Unit Suites (19 files, 110 tests)**:
   - `AssistantWorkspace.test.tsx`
   - `AssistantDraftLifecycle.test.tsx`
   - `AssistantIntegratedJourney.test.tsx`
   - `AssistantAttention.test.tsx`
   - `AssistantPreparation.test.tsx`
   - `ReviewAssistant.test.tsx`
   - `ReviewAssistantActions.test.tsx`
   - `ReviewAssistantFacts.test.tsx`
   - `ReviewAssistantGeneration.test.tsx`
   - `ReviewAssistantLifecycle.test.tsx`
   - `ReviewAssistantSelected.test.tsx`
   - `ReviewAssistantSidePanel.test.tsx`
   - `GuidedOrderCreation.test.tsx`
   - `GuidedPaymentEntry.test.tsx`
   - `GuidedPaymentOutcomes.test.tsx`
   - `assistantConversation.test.ts`
   - `guidedPayment.test.ts`
   - `AttentionPreview.test.tsx`
   - `PreparationPreview.test.tsx`
2. **Focused Backend Suites**:
   - `tests/test_review_assistance_api.py`
   - `tests/test_review_assistance_context.py`
   - `tests/test_review_generation.py`
   - `tests/test_review_generation_privacy.py`
3. **Repository Gates**:
   - `npm run conventions` (file size, documentation, rules)
   - `npm run typecheck` (strict TypeScript, zero any)
   - `npm run check` (full pre-commit root gate)

## 2026-11-03 — Last-commit review corrections

Reviewed `1066225` against parent `1a0d496` on separate Standards and Spec axes.
Standards: three findings (shadow-only input focus, missing numeric typeface,
moving launcher hover). Spec: three findings (missing Remaining COD tally,
Bengali text clearance overrides, missing numeric typeface).

Restored explicit focus outlines, removed the hover movement, applied the existing
mono token to numeric inputs and values, and preserved body type for prose.
Added a localized Remaining COD row derived from validated minor-unit amounts,
plus regression assertions for recalculation and a Bengali zero balance.
Review explanation/advisory text now receives Bengali clearance directly, with
the panel's language explicitly set from its locale.

Focused frontend verification: four suites, 27 tests passed (guided order/payment,
review facts and side panel). Initial root check stopped at an inaccessible Windows
pytest temp directory (692 passed, 179 skipped, one fixture error). Rerun:
`PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-assistant-review-20261103`
with `npm run check`: all stages passed. Evidence:
`.cache/checks/check-1orE7W/result.json`.

Browser visual acceptance, physical-device keyboards, PostgreSQL integration,
and live providers were not run. Local gate results do not establish those gates.
Next action: verify assistant focus, Bengali clearance and numeric presentation in
the browser at the package's mobile/desktop viewport matrix.
