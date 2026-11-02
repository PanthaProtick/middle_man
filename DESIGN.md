---
name: "Middleman Shop Desk"
version: "1.0.0"
description: "Design system tokens and specifications for Middleman — a quiet, mobile-friendly F-commerce shop desk and buyer confirmation portal."
colors:
  primary: "#146653"
  primary-hover: "#0e5141"
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
  accent-cyan: "#166b78"
  accent-emerald: "#197047"
  accent-amber: "#8a570b"
  accent-rose: "#b33448"
typography:
  fontFamilies:
    heading: "Manrope, Nirmala UI, Noto Sans Bengali, Vrinda, sans-serif"
    body: "Manrope, Nirmala UI, Noto Sans Bengali, Vrinda, sans-serif"
    mono: "DM Mono, monospace"
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
  3xl: "48px"
rounded:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  full: "9999px"
shadows:
  sm: "0 1px 2px rgba(25, 47, 41, 0.05)"
  md: "0 2px 10px rgba(20, 102, 83, 0.04)"
  lg: "0 4px 14px rgba(20, 102, 83, 0.07)"
  card: "0 3px 16px rgba(25, 59, 41, 0.06)"
---

## Overview
Middleman is a quiet, mobile-friendly shop desk and buyer confirmation portal for F-commerce (Facebook and social commerce) merchants in Bangladesh. The design language emphasizes calmness, high information density without visual noise, rapid thumb-driven operations, and clear bilingual communication (English and Bengali).

The system encompasses two main surfaces:
1. **Seller Workspace**: A merchant control desk for reconciling delivery advances, tracking orders, managing payment accounts, and preparing Pathao courier parcels.
2. **Buyer Portal**: A standalone, high-trust single-order view (`/orders/:token`) where buyers review agreed order terms, copy verified payment numbers (bKash/Nagad), and submit payment claims.

## Colors
Middleman uses a restrained palette anchored in earthy slate greens and calm off-white paper surfaces, strictly operating in light theme (`color-scheme: light`):

- **Primary Accent (`#146653`)**: Deep pine teal used for primary action buttons, active navigation states, key status badges, and focus rings.
- **Primary Hover (`#0e5141`)**: Deepened teal for interactive hover states without layout shift.
- **Background Main (`#f5f6f2`)**: Warm, glare-resistant desk canvas tone.
- **Surface Card (`#ffffff`)**: Pure white elevated background for isolated content sections, cards, and input fields.
- **Surface Secondary (`#f3f6f4`)**: Subtle soft background for sub-panels, table headers, and tab containers.
- **Text Primary (`#192f29`)**: Deep forest ink providing >7:1 contrast ratio against white surfaces for effortless readability.
- **Text Secondary (`#4e655c`)**: Subdued slate-green for labels, supporting copy, and metadata (>4.5:1 contrast).
- **Text Muted (`#596f65`)**: Neutral muted tone for secondary placeholders and microcopy.
- **Borders (`#d8e2dd` subtle, `#9bb4a9` hover, `#146653` focus)**: Crisp tactile dividers.
- **Status Indicators**:
  - Emerald (`#197047`): Confirmed orders, active accounts, verified matches.
  - Cyan (`#166b78`): Delivery notices, info badges, parcel tracking.
  - Amber (`#8a570b`): Unseen orders, pending claims, awaiting actions.
  - Rose (`#b33448`): Rejected payments, offline alerts, critical warnings.

## Typography
Typography balances clean modern Latin sans-serif with native Bengali glyph support and tabular numeric clarity:

- **Heading & Body Font**: `Manrope` with robust fallback to Bengali system fonts (`Nirmala UI`, `Noto Sans Bengali`, `Vrinda`, `Shonar Bangla`, system-ui, sans-serif).
- **Monospace Font**: `DM Mono` for order IDs, transaction numbers (TrxID), phone numbers, and currency values.
- **Scale**:
  - `xs` (0.75rem / 12px): Badges, counters, metadata labels.
  - `sm` (0.85rem / 13.6px): Field labels, secondary descriptions, table cells.
  - `base` (0.9375rem / 15px): Default body copy, interactive buttons, inputs.
  - `lg` (1.125rem / 18px): Card headers, modal titles.
  - `xl` (1.25rem / 20px): Section titles, prominent metric values.
  - `2xl` / `3xl` (1.5rem - 2.25rem): Masthead titles and brand hero displays.
- **Script Handling**:
  - Bengali script (`:lang(bn)`): Line height increased to `1.7` (`body:lang(bn) { line-height: 1.7; }`) to ensure full clearance of ascenders, descenders, and complex conjuncts.
  - Tabular Numerics: All financial metrics and amounts utilize `font-variant-numeric: tabular-nums` to avoid column jitter.

## Layout & Spacing
- **Container Architecture**:
  - Seller Workspace: Max width `1280px` (`.app-container`), centered with fluid horizontal padding (`16px` mobile, `32px` desktop).
  - Buyer Portal: Single focused column constrained to `720px` (`.portal-shell`).
- **Spacing Scale**:
  - Micro / Inline (`--pill-gap: 4px`): Pill tags, icon-to-label gaps, badge internals.
  - Standard Gap (`--space-sm: 8px`, `--section-gap: 12px`): Between related form fields, metric items, and card subsections.
  - Section Spacing (`16px` - `24px`): Padding inside cards, isolated sections, and list containers.
  - Block Separators (`32px` - `48px`): Top-level navigation, hero mastheads, and footer margins.
- **Breakpoints**:
  - Desktop (>1024px): 5-column metric ribbon, 2-column masthead, side-by-side reconciliation panels.
  - Tablet (768px - 1024px): 3-column metric ribbon, fluid cards.
  - Mobile (<=480px): 2-column metrics ribbon, stacked navigation tabs, full-width touch actions, zero horizontal scroll.

## Elevation & Depth
- **Philosophy**: Middleman uses physical borders and subtle opacity tints rather than loud drop shadows.
- **Shadow Tokens**:
  - Card base: `0 3px 16px rgba(25, 59, 41, 0.06)` for soft physical lift.
  - Isolated subcard: `0 2px 10px rgba(20, 102, 83, 0.04)`.
  - Hover states: `0 4px 14px rgba(20, 102, 83, 0.07)` with crisp border color transition.
- **Focus Outlines**: Active keyboard focus is indicated by an explicit 3px outline (`outline: 3px solid var(--primary-accent); outline-offset: 3px;`), never obscured or replaced by shadow-only rings.
- **Modals & Overlays**: Semi-transparent backdrop (`rgba(0, 0, 0, 0.5)`) with `backdrop-filter: blur(4px)`; modal container bounded to `500px` max-width.

## Shapes & Geometry
- **Border Radii**:
  - Small Controls (`--radius-xs: 6px`, `--radius-sm: 10px`): Badges, table pills, mini buttons, and language switcher buttons.
  - Cards & Sections (`--radius-md: 12px`): Main content cards, form containers, isolated sections.
  - Large Elements (`--radius-lg: 18px`, `--radius-xl: 24px`): Masthead containers, modal dialogs, workflow guide boxes.
  - Full (`--radius-full: 9999px`): Status dots and indicator pills.
- **Touch Geometry**: All interactive elements (buttons, inputs, selects, tab buttons) enforce a strict minimum touch target height of `44px` (`min-height: 44px`) to accommodate one-handed phone usage.

## Components
- **Buttons**:
  - `.btn-primary`: Solid pine teal background (`#146653`), crisp white text, min-height 44px, smooth 180ms background transition to `#0e5141` on hover. No layout-shifting transforms.
  - `.btn-secondary`: Crisp white background with `#b8c9c0` border, hovering to `#edf4ef`.
- **Inputs & Selects**:
  - Min-height 46px, minimum 16px font-size to prevent automatic mobile zoom. Clean white background with `#b8c9c0` border, focusing to a 3px `#14665320` halo with clear dark teal border.
- **Metric Chips (`.metric-chip`)**:
  - High-density data chips displaying a 32x32px or 38x38px icon container, bold tabular value (`font-variant-numeric: tabular-nums`), and clear secondary label.
- **Isolated Sections (`.isolated-section`)**:
  - Self-contained cards encapsulating a single workflow responsibility (e.g., payment accounts, order intake, courier handoff). Includes title with icon, contextual description, and optional action toolbar.
- **Language Switcher (`.locale-switch`)**:
  - Segmented toggle (`EN` / `বাংলা`) utilizing `aria-pressed` for accessibility, compact padding, and sticky discoverability across both mobile and desktop viewports.
- **Buyer Payment Destination Card**:
  - Highlighted destination panel (`#eaf4ee` background, `#b8d5c5` border) clearly displaying merchant payment number with immediate one-tap copy button and instructions.

## Do's and Don'ts
### Do
- **Do** maintain a minimum 44px touch target height for every clickable element (`button`, `a`, `select`, `input`).
- **Do** test both English and Bengali text expansions across all screens to prevent text overflow or clipping.
- **Do** apply `font-variant-numeric: tabular-nums` to financial amounts, phone numbers, and TrxIDs.
- **Do** use Lucide SVG icons with appropriate `aria-hidden="true"` or accessible descriptions; never use raw emojis as UI icons.
- **Do** respect `prefers-reduced-motion` by reducing animation and transition durations to `.01ms`.
- **Do** maintain a minimum contrast ratio of 4.5:1 for body copy and 3:1 for large text and interactive components.

### Don't
- **Don't** introduce dark mode overrides or invert colors; Middleman is purposefully designed as a calm, light-only shop desk.
- **Don't** use layout-shifting hover transforms (e.g., `scale(1.05)`) that induce jitter or reflow.
- **Don't** introduce fixed pixel widths that cause horizontal scrollbars on mobile viewports (down to 360px).
- **Don't** suppress `:focus-visible` outlines or rely on subtle color-only changes to convey focus or state.
- **Don't** use decorative gradients, glassmorphism blurs, or glow effects that detract from clean shop bookkeeping.
