# Package 02 — Visual World, Screen Architecture & Interaction Decisions

Status: Package 02 complete — visual world, screen architecture, and interaction prototypes recorded  
Date: 2026-11-02 (Asia/Dhaka)  
Parent: [Revamp implementation roadmap](implementation-roadmap.md)  
Reference: Impeccable operate mode; `seed:e748c54007a5a0d6`

---

## 1. Visual Direction Evaluation & Candidate Synthesis

Six competing visual directions were evaluated against real Dhaka social-commerce workflows:

1. **Candidate 1 (Transactional Ledger)**: High-density tabular figures, double-entry alignment. Strong on finance, but lacked visual status hierarchy and mobile scannability.
2. **Candidate 2 (Boarding Pass Cards)**: Segmented status chips and scannable cards. Exceptional at glanceable states, but lacked shop desk continuity.
3. **Candidate 3 (Catalog Sleeve)**: Sequential immutable identifiers (`#MM-1042`, `TX-9842`), zero decorative clutter. Strong provenance, but neglected Bengali ascender/descender geometry.
4. **Candidate 4 (Minimalist Micro-SaaS)**: Cool grays, floating shadows. Rejected: washed out under outdoor mobile lighting and Dhaka ambient shop environments.
5. **Candidate 5 (Chat-First Inbox)**: Conversational bubble stream. Rejected: blurred critical state transitions between payment claims and ledger confirmation.
6. **Candidate 6 (Modern Dhaka Shop Desk — Selected)**: Grounded in contemporary social-commerce studio desks in Bangladesh. Combines warm desk canvas (`#f5f6f2`), deep pine teal (`#146653`), and forest ink (`#192f29`). Synthesized with:
   - *Candidate 2's segmented card scannability* for orders and payment claims.
   - *Candidate 1's tabular numeric discipline* for currency and TrxIDs.
   - *Candidate 3's catalog sleeve discipline* for immutable sequential identifiers.

Design tokens, script clearance rules, and touch geometry are canonical in [DESIGN.md](../../DESIGN.md).

---

## 2. Screen Architecture & Navigation Hierarchy

The application shell resolves into two primary sections and an administrative settings desk:

- **App Shell Header**: Compact height (56px desktop, 52px phone). Contains shop identity, "+ New Order" action, segmented `EN` / `বাংলা` toggle, and session menu.
- **First-Run Help**: Dismissible 3-step checklist ("1. Add Account", "2. Create Order", "3. Connect Pathao"). Auto-collapses once work exists.
- **Section Rail**: Segmented rail: `Orders` (attention badge), `Payments` (unallocated claim badge), and `Settings` (accounts, Pathao, retention).
  - *Delivery alignment*: Courier parcel dispatch and Pathao reconciliation are embedded workflows within Orders, not a disjoint top-level application (per `revamp-plan.md`).
- **Work Queues**: Server-predicate queries lead: `Needs Attention` (unconfirmed, pending claims, courier conflicts), `Ready for Delivery` (confirmed, awaiting consignment), `All Orders` (full search and filters).
- **Detail View Topology**:
  - *Desktop (>1024px)*: Right-docked drawer (540px width) with sticky header (Order #, amounts, status) and 4 tabs (`Overview`, `Payment`, `Delivery`, `Buyer Link`).
  - *Mobile (<768px)*: Full-screen modal sheet with sticky top bar and thumb-accessible bottom action bar.
- **Assistant Window**: Floating trigger button; expands into drawer on desktop or bottom sheet on mobile. Local system matches strictly separated from Gemini AI advisory notes. All mutations require explicit seller confirmation locks.
- **Mobile Scroll Topology**: Single window-level scroll on workspace; modals lock body scroll and provide internal scroll with sticky headers and action footers. Zero nested scrollbars.

Screen diagrams and complete geometry specifications are maintained in [DESIGN.md](../../DESIGN.md#screen-architecture--navigation-hierarchy).

---

## 3. Surface Briefs for Downstream Waves

To prevent drift during component and screen migration, three surface briefs define boundary contracts:

- **Surface Brief A (Seller Workspace)**:
  - *Screens*: Daily work queue, order detail drawer, assistant drawer.
  - *Core Tasks*: Review payment claims, confirm advance payments, dispatch Pathao courier parcels, inspect customer addresses.
  - *Key Constraints*: 44px min touch targets, 46px min input height, tabular numeric display, clear distinction between deterministic facts and AI suggestions.
- **Surface Brief B (Buyer Portal `/orders/:token`)**:
  - *Screens*: Public single-order view, payment verification form.
  - *Core Tasks*: Review order terms, copy merchant bKash/Nagad number with one tap, submit sender phone and TrxID, fallback to manual written address.
  - *Key Constraints*: Standalone zero-auth security, high visual trust, bilingual error feedback, mobile-first responsive layout (320px–390px).
- **Surface Brief C (Settings Desk)**:
  - *Screens*: Receiving accounts management, Pathao integration setup, data retention rules.
  - *Core Tasks*: Configure active bKash/Nagad numbers, test courier webhooks, configure cleanup policies.
  - *Key Constraints*: Guided empty states, explicit destructive confirmations, offline standby resilience.

---

## 4. Interaction Prototypes & Concrete Scenarios

Five interactive prototypes in `.cache/prototypes/` demonstrate the interaction models across desktop (1040px), mobile (390px), and compact mobile (320px):

| Scenario | Viewport | Trigger / State | Acceptance Outcome |
|---|---|---|---|
| **A. Payment Review** | 390px & 1040px | Order #MM-1042: Buyer claims ৳150 via bKash TrxID `9K42MX7P1Q`. | UI matches claim against SMS inbox receipt; seller clicks "Accept Advance"; status transitions to Confirmed; COD due remains ৳1,300. |
| **B. Unknown Courier** | 390px & 1040px | Order #MM-1038: Pathao booking times out (504 gateway error). | Booking outcome displays `unknown` warning; re-submission button is locked; explicit "Attach Consignment" or "Confirm Non-Creation" actions displayed. |
| **C. Bengali Expansion** | 320px, 390px, 1040px | Long Bengali title: "হাতে বোনা খাঁটি তসর সিল্ক জামদানি শাড়ি...", address "চর বাউশিয়া, ভৈরব বাজার". | Zero text clipping, no horizontal scroll; line-height 1.7 preserves conjunct clearance; tabular numbers render aligned. |
| **D. No Accounts** | 390px & 1040px | New shop with 0 configured receiving accounts. | Order creation and buyer portal display guided empty notice: "Payment accounts being configured"; direct action to "Add Account". |
| **E. Buyer Validation** | 390px | Buyer opens `/orders/:token`; submits empty phone & invalid TrxID. | Form retains valid fields; focuses first invalid input; shows accessible bilingual error; written address fallback remains available. |

Prototypes can be viewed by opening `.cache/prototypes/index.html`.

---

## 5. Explicit Decisions & Rejected Trade-offs

1. **Rejected Dark Mode**: Middleman is strictly a calm light-only shop desk (`color-scheme: light`). F-commerce bookkeeping occurs in bright ambient shop lighting and outdoors on phones.
2. **Rejected Top-Level Delivery Application**: Kept delivery parcels and courier reconciliation inside Orders to preserve single-pane attention flow.
3. **Rejected URL State for Private Drafts**: URLs must not hold personal customer numbers, bearer links, or draft payloads. Navigation between sections must preserve pending writes.
4. **Rejected Fluid Clamp Typography**: Clamp formulas cause unpredictable layout reflows in data-heavy shop desks. A fixed rem scale with 44px min touch heights and 16px min form text is strictly enforced.
5. **Rejected Universal Modals**: Modals are reserved for focused tasks (create order, inspect detail). Routine operations (filter, sort, search, view status) occur inline in the work queue.
6. **Rejected AI Auto-Mutations**: Gemini model suggestions are strictly advisory. Mutation authority remains exclusively with explicit seller button confirmation.

---

## 6. Downstream Package Alignment

With Package 02 complete, downstream work proceeds per `implementation-roadmap.md`:
- **Package 03 (Next)**: Tokens, primitives, and CSS ownership in `frontend/src/styles/` and `components/`.
- **Package 04**: Shared layout primitives and App Shell migration.
- **Package 05**: Surface migration — Settings Desk.
