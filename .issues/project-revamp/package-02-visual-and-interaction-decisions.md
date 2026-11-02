# Package 02 — Visual World, Screen Architecture & Interaction Decisions

Status: Package 02 planning complete — ready for compaction & prototype coding  
Date: 2026-11-02 (Asia/Dhaka)  
Parent: [Revamp implementation roadmap](implementation-roadmap.md)  
Reference: Impeccable operate mode; `seed:e748c54007a5a0d6` (Candidate 6 assigned)

---

## 1. Chosen Visual World & Design Foundation

The visual identity is anchored in **Candidate 6: Modern Dhaka Shop Desk / Studio Counter (মডার্ন অনলাইন শপ স্টুডিও ডেস্ক)**, rooted in contemporary social-commerce studio desks in Bangladesh, raised by three challenger disciplines:

1. **Boarding Pass / Gate Board Segmented Scannability** (from Challenger 2): Segmented cards with live status chips; alert colors reserved exclusively for actual exceptions; scannable order and delivery summary blocks.
2. **Variable Font Typographic Discipline** (from Challenger 1): Strict 1.125–1.2 scale ratio; hierarchy achieved through scale and weight contrast rather than decorative clutter; tabular figures for money, TrxIDs, and phones.
3. **Saville Catalog Sleeve Discipline** (from Challenger 3): Immutable sequential identifiers (`#MM-1042`, `TX-9842`, `CONS-7419`); zero decorative gradients, blurs, or faux-3D embellishments.

### Core Tokens
- **Canvas & Surfaces**: Background canvas `#f5f6f2` (warm glare-resistant paper); surface cards `#ffffff`; secondary panels `#f3f6f4`.
- **Ink & Typography**: Forest ink `#192f29` (>7:1 contrast on white); secondary slate `#4e655c` (>4.5:1); muted microcopy `#596f65`.
- **Primary & Actions**: Deep pine teal `#146653`, hover `#0e5141`, active `#0a3d31`.
- **Tactile Dividers**: Border subtle `#d8e2dd`, hover `#9bb4a9`, focus ring `#146653` (3px outline, 3px offset).
- **Semantic Status**: Confirmed/Matched emerald `#197047`; Delivery/Info cyan `#166b78`; Pending/Unseen amber `#8a570b`; Rejected/Error rose `#b33448`.
- **Sizing Constraints**: Strict minimum touch target height of `44px`; form inputs `min-height: 46px` and `font-size: 16px` (prevents iOS mobile auto-zoom); Bengali line-height `1.7` (`:lang(bn)`).

---

## 2. Screen Architecture & Navigation Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│ App Shell Header (56px): Middleman | Shop Name | + New Order | EN/বাংলা │
├────────────────────────────────────────────────────────────────────────┤
│ Compact First-Run Bar (auto-collapses once an order or account exists) │
├────────────────────────────────────────────────────────────────────────┤
│ Segmented Section Rail: [ Orders (3) ]  [ Payments (1) ]  [ Delivery ] │
├────────────────────────────────────────────────────────────────────────┤
│ Work Query Switcher: [ Needs Attention ]  [ Ready to Ship ]  [ All ]   │
├────────────────────────────────────────────────────────────────────────┤
│ Shop Metrics Ribbon: Today (12) | Confirmed (9) | Adv ৳1,350 | COD ৳14k│
├────────────────────────────────────────────────────────────────────────┤
│ Daily Work Queue (Responsive Cards: 2-col desktop, 1-col mobile)      │
│  - Order #MM-1042 | Tanpila Akter | ৳1,450 (Adv ৳150 / COD ৳1,300)     │
│  - Primary Action: [ Review Payment Claim ]                            │
└────────────────────────────────────────────────────────────────────────┘
```

### Hierarchy Breakdown
- **App Shell Header**: Compact height (56px desktop, 52px phone). Contains shop identity, primary "+ New Order" button, segmented `EN` / `বাংলা` toggle, and session menu.
- **First-Run Help**: Dismissible / auto-collapsing 3-step checklist ("1. Add Account", "2. Create Order", "3. Connect Pathao"). Never displaces repeat work down the viewport.
- **Section Rail**: Segmented tab rail: `Orders` (with attention badge), `Payments` (with unallocated badge), `Delivery` (staging), `Settings` (accounts, Pathao, retention).
- **Work Queues**: Server-predicate queries lead: `Needs Attention` (unconfirmed, pending claims, conflicts), `Ready for Delivery` (confirmed, awaiting consignment), `All Orders` (full search, filters, export).
- **Order Card Anatomy**: Card header has Order ID + status pill; body contains customer name, phone, item summary; tally block has high-contrast Advance vs COD breakdown; footer has single primary action.
- **Detail View Topology**:
  - *Desktop (>1024px)*: Right-docked drawer (540px width) with sticky header (Order #, amounts, status) and 4 tabs (`Overview`, `Payment`, `Delivery`, `Buyer Link`).
  - *Mobile (<768px)*: Full-screen modal sheet with sticky top bar and thumb-accessible bottom action bar.
- **Assistant Window**: Floating trigger button (bottom-right); expands into side drawer on desktop or bottom sheet on mobile. Local system matches clearly separated from Gemini AI advisory notes. All mutations require explicit seller confirmation lock.
- **Mobile Scroll Topology**: Single window-level scroll on workspace; modals lock body scroll and provide internal scroll with sticky headers and action footers. Zero nested scrollbars.

---

## 3. Interaction Prototypes & Concrete Scenarios

Prototypes will be placed in `.cache/prototypes/` for interactive rendering:

| Scenario | Viewport | Trigger / State | Acceptance Outcome |
|---|---|---|---|
| **A. Payment Review** | 390px & 1440px | Order #MM-1042: Buyer claims ৳150 via bKash TrxID `9K42MX7P1Q`. | UI matches claim against SMS inbox receipt; seller clicks "Accept Advance"; status transitions to Confirmed; COD due remains ৳1,300. |
| **B. Unknown Courier** | 390px & 1440px | Order #MM-1038: Pathao booking times out (504 gateway error). | Booking outcome displays `unknown` warning; re-submission button is locked; explicit "Attach Consignment" or "Confirm Non-Creation" actions displayed. |
| **C. Bengali Expansion** | 320px, 390px, 1440px | Long Bengali title: "হাতে বোনা খাঁটি তসর সিল্ক জামদানি শাড়ি...", address "চর বাউশিয়া, ভৈরব বাজার". | Zero text clipping, no horizontal scroll; line-height 1.7 preserves conjunct clearance; tabular numbers render aligned. |
| **D. No Accounts** | 390px & 1440px | New shop with 0 configured receiving accounts. | Order creation and buyer portal display guided empty notice: "Payment accounts being configured"; direct action to "Add Account". |
| **E. Buyer Validation** | 390px | Buyer opens `/orders/:token`; submits empty phone & invalid TrxID. | Form retains valid fields; focuses first invalid input; shows accessible bilingual error; written address fallback remains available. |

---

## 4. Explicit Decisions & Rejected Trade-offs

1. **Rejected Dark Mode**: Middleman is strictly a calm light-only shop desk (`color-scheme: light`). F-commerce bookkeeping occurs in bright ambient shop lighting and outdoors on phones.
2. **Rejected URL State for Private Drafts**: URLs must not hold personal customer numbers, bearer links, or draft payloads. Navigation between sections must preserve pending writes.
3. **Rejected Fluid Clamp Typography**: Clamp formulas cause unpredictable layout reflows in data-heavy shop desks. A fixed rem scale with 44px min touch heights and 16px min form text is strictly enforced.
4. **Rejected Universal Modals**: Modals are reserved for focused tasks (create order, inspect detail). Routine operations (filter, sort, search, view status) occur inline in the work queue.
5. **Rejected AI Auto-Mutations**: Gemini model suggestions are strictly advisory. Mutation authority remains exclusively with explicit seller button confirmation.

---

## 5. Post-Compaction Implementation Plan (Package 02 Execution)

Upon compaction completion, execute the following implementation steps:
1. **Design System Update**: Update `DESIGN.md` with refined tokens, touch target rules, Bengali typography scale, and component guidelines.
2. **Interactive Prototypes**: Create lightweight, self-contained interactive prototype files in `.cache/prototypes/` covering Scenarios A through E with real English and Bengali data.
3. **Roadmap Progress Update**: Update `implementation-roadmap.md` to record Package 02 as complete with decisions and prototypes referenced.
4. **Verification**: Run `npm run conventions` and focused checks.
5. **Git Commit**: Commit with message `docs: complete revamp package 02 visual world and interaction prototypes`.
