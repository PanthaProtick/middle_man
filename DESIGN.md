---
name: "Middleman Shop Desk"
version: "1.1.0"
description: "Modern Dhaka Shop Desk design system — a quiet, mobile-first F-commerce workspace and buyer confirmation portal."
colors:
  primary: "#146653"
  primary-hover: "#0e5141"
  primary-active: "#0a3d31"
  background: "#f5f6f2"
  surface: "#f3f6f4"
  surface-card: "#ffffff"
  surface-hover: "#f5faf8"
  text-primary: "#192f29"
  text-secondary: "#4e655c"
  text-muted: "#596f65"
  border: "#d8e2dd"
  border-hover: "#9bb4a9"
  border-focus: "#146653"
  status-emerald: "#197047"
  status-emerald-bg: "#eaf4ee"
  status-cyan: "#166b78"
  status-cyan-bg: "#e7f4f6"
  status-amber: "#8a570b"
  status-amber-bg: "#fdf6ea"
  status-rose: "#b33448"
  status-rose-bg: "#fbebee"
typography:
  fontFamilies:
    heading: "Manrope, 'Noto Sans Bengali', 'Nirmala UI', sans-serif"
    body: "Manrope, 'Noto Sans Bengali', 'Nirmala UI', sans-serif"
    mono: "'DM Mono', monospace"
  scale:
    xs: "0.75rem"
    sm: "0.85rem"
    base: "0.9375rem"
    lg: "1.125rem"
    xl: "1.25rem"
    2xl: "1.5rem"
    3xl: "2.25rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
---

## Visual Direction: Modern Dhaka Shop Desk
Middleman is anchored in **Candidate 6: Modern Dhaka Shop Desk / Studio Counter (মডার্ন অনলাইন শপ স্টুডিও ডেস্ক)**, rooted in contemporary social-commerce studio desks in Bangladesh. The design combines high information density with visual calmness, reinforced by three challenger disciplines:

1. **Boarding Pass / Gate Board Segmented Scannability**: Segmented cards with live status chips; alert colors reserved exclusively for genuine exceptions; scannable order and delivery summary blocks.
2. **Variable Font Typographic Discipline**: Strict 1.125–1.2 scale ratio; hierarchy achieved through scale and weight contrast rather than decorative clutter; tabular figures for money, TrxIDs, and phones.
3. **Saville Catalog Sleeve Discipline**: Immutable sequential identifiers (`#MM-1042`, `TX-9842`, `CONS-7419`); zero decorative gradients, blurs, shadows-as-structure, or faux-3D embellishments.

The system encompasses two main surfaces:
1. **Seller Workspace**: A merchant control desk for reconciling delivery advances, tracking orders, managing payment accounts, and preparing Pathao courier parcels.
2. **Buyer Portal**: A standalone, high-trust single-order view (`/orders/:token`) where buyers review agreed order terms, copy verified payment numbers (bKash/Nagad), and submit payment claims.

## Screen Architecture & Navigation Hierarchy
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
│ Daily Work Queue (Responsive Cards: 2-col desktop, 1-col mobile)      │
└────────────────────────────────────────────────────────────────────────┘
```

- **App Shell Header**: Compact height (56px desktop, 52px phone). Contains shop identity, primary "+ New Order" button, segmented `EN` / `বাংলা` toggle, and session menu.
- **First-Run Help**: Dismissible / auto-collapsing 3-step checklist ("1. Add Account", "2. Create Order", "3. Connect Pathao"). Never displaces repeat work down the viewport.
- **Section Rail**: Segmented tab rail: `Orders` (with attention badge), `Payments` (with unallocated badge), `Delivery` (staging), `Settings` (accounts, Pathao, retention).
- **Work Queues**: Server-predicate queries lead: `Needs Attention` (unconfirmed, pending claims, conflicts), `Ready for Delivery` (confirmed, awaiting consignment), `All Orders` (full search, filters, export).
- **Detail View Topology**:
  - *Desktop (>1024px)*: Right-docked drawer (540px width) with sticky header (Order #, amounts, status) and 4 tabs (`Overview`, `Payment`, `Delivery`, `Buyer Link`).
  - *Mobile (<768px)*: Full-screen modal sheet with sticky top bar and thumb-accessible bottom action bar.
- **Assistant Window**: Floating trigger button (bottom-right); expands into side drawer on desktop or bottom sheet on mobile. Local deterministic system matches clearly separated from Gemini AI advisory notes. All mutations require explicit seller confirmation locks.
- **Mobile Scroll Topology**: Single window-level scroll on workspace; modals lock body scroll and provide internal scroll with sticky headers and action footers. Zero nested scrollbars.

## Colors & Surfaces
Middleman operates strictly in a calm light theme (`color-scheme: light`):
- **Primary Accent (`#146653`)**: Deep pine teal for primary buttons, active tabs, and focus outlines. Hover: `#0e5141`, Active: `#0a3d31`.
- **Canvas (`#f5f6f2`)**: Warm, glare-resistant desk paper canvas.
- **Surface Card (`#ffffff`)**: Pure white elevated background for cards and inputs.
- **Surface Secondary (`#f3f6f4`)**: Soft background for sub-panels and table headers.
- **Text Primary (`#192f29`)**: Deep forest ink providing >7:1 contrast ratio against white.
- **Text Secondary (`#4e655c`)**: Subdued slate-green for labels and metadata (>4.5:1).
- **Text Muted (`#596f65`)**: Neutral muted tone for secondary placeholders and microcopy.
- **Borders (`#d8e2dd` subtle, `#9bb4a9` hover, `#146653` focus)**: Crisp tactile dividers.
- **Semantic Status**:
  - Emerald (`#197047`, bg `#eaf4ee`): Confirmed orders, active accounts, verified matches.
  - Cyan (`#166b78`, bg `#e7f4f6`): Delivery notices, info badges, parcel tracking.
  - Amber (`#8a570b`, bg `#fdf6ea`): Unseen orders, pending claims, awaiting actions.
  - Rose (`#b33448`, bg `#fbebee`): Rejected payments, offline alerts, critical warnings.

## Typography & Script Rules
- **Font Stack**: `Manrope` with robust fallback to Bengali system fonts (`Noto Sans Bengali`, `Nirmala UI`, `Vrinda`, sans-serif).
- **Monospace Font**: `DM Mono` for order IDs, transaction numbers (TrxID), phone numbers, and currency values.
- **Bengali Script Clearance**: Line-height set to `1.7` (`body:lang(bn) { line-height: 1.7; }`) to ensure full clearance of ascenders, descenders, and complex conjuncts (e.g., র্, ্র, ্ক, ক্ষ, ্তু, ্য).
- **Tabular Figures**: All financial metrics, phone numbers, and TrxIDs utilize `font-variant-numeric: tabular-nums` to eliminate column jitter.
- **Form Text**: Form inputs enforce minimum `16px` font-size to prevent iOS mobile auto-zoom.

## Sizing & Touch Geometry
- **Touch Targets**: All interactive elements (`button`, `a`, `select`, `input`, `tab`) enforce a strict minimum touch target height of `44px` (`min-height: 44px`).
- **Input Geometry**: Form controls have `min-height: 46px` and minimum `16px` font size.
- **Focus Outlines**: Active keyboard focus is indicated by an explicit 3px outline (`outline: 3px solid var(--primary-accent); outline-offset: 3px;`), never obscured or replaced by shadow-only rings.

## Components
- **Buttons**:
  - `.btn-primary`: Solid pine teal (`#146653`), crisp white text, min-height 44px, smooth 150ms background transition to `#0e5141` on hover. No layout-shifting transforms.
  - `.btn-secondary`: Crisp white background with `#d8e2dd` border, hovering to `#f3f6f4`.
- **Inputs & Selects**: Min-height 46px, 16px font-size. White background with `#d8e2dd` border, focusing to `#146653` outline.
- **Order Cards**: Boarding-pass anatomy: header with Order ID + status chip; customer name, phone, item summary; tally box with high-contrast Advance vs COD breakdown; primary action button in footer.
- **Language Switcher**: Segmented toggle (`EN` / `বাংলা`) with `aria-pressed`, compact padding, discoverable on mobile and desktop.
- **Payment Destination Card**: Highlighted panel (`#eaf4ee` background, `#b8d5c5` border) with merchant payment number and one-tap copy button.

## Do's and Don'ts
### Do
- **Do** maintain a minimum 44px touch target height for every clickable element (`button`, `a`, `select`, `input`).
- **Do** test both English and Bengali text expansions across all screens (320px, 390px, 1440px) to prevent clipping.
- **Do** apply `font-variant-numeric: tabular-nums` to financial amounts, phone numbers, and TrxIDs.
- **Do** respect `prefers-reduced-motion` by reducing animation and transition durations to `.01ms`.
- **Do** maintain a minimum contrast ratio of 4.5:1 for body copy and 3:1 for large text and interactive components.

### Don't
- **Don't** introduce dark mode overrides or invert colors; Middleman is strictly a calm light-only shop desk.
- **Don't** use layout-shifting hover transforms (e.g., `scale(1.05)`) that induce jitter or reflow.
- **Don't** introduce fixed pixel widths that cause horizontal scrollbars on mobile viewports (down to 320px).
- **Don't** suppress `:focus-visible` outlines or rely on subtle color-only changes to convey focus or state.
- **Don't** use decorative gradients, glassmorphism blurs, or glow effects that detract from clean shop bookkeeping.
