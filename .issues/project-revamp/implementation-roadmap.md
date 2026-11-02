# Revamp implementation roadmap

Status: proposed; packages below are not implementation tickets yet
Parent: [full revamp plan](revamp-plan.md)
Ordering: finish focused proof for one cluster before changing subsequent screens.

## Wave A: establish evidence and choose the design

### 01 — Baseline and complete journey map

Progress 2026-11-02: **complete**. [Baseline](baseline.md),
[journey/contract map](baseline-journeys.md), [control trace](baseline-action-trace.md)
and [expert walkthroughs](baseline-walkthroughs.md) record source/visual evidence,
reproduction, external-validation limits and retained pilot tasks. Package 02 has
not started. The baseline commit is the commit introducing these records.

- **Owners:** `App.tsx`, `Root.tsx`, seller/buyer features, locale, current contracts.
- Capture current English/Bengali seller, buyer, access/setup, settings, detail,
  assistant, and recovery states at phone and desktop sizes with synthetic records.
- Trace every visible action to its hook, API, response, error, and regression test.
  Label unreachable code separately from supported user flows.
- Observe representative seller/buyer tasks and record baseline outcomes; if pilot
  users are unavailable, mark expert walkthroughs as hypotheses and retain pilot validation.
- **Done:** surface/state inventory is complete; each assertion has source or visual
  evidence; current screenshots have reproducible fixtures and a baseline commit.
- **Dependencies:** none. No UI or domain mutation in this package.

### 02 — Visual world, architecture of screens, and interaction prototypes

Progress 2026-11-02: **complete**. Direction and interaction model selected and
recorded in [Package 02 decisions](package-02-visual-and-interaction-decisions.md)
(Candidate 6: Modern Dhaka Shop Desk, reinforced by boarding pass scannability,
variable font contrast, and catalog sleeve discipline). Design system updated in
[DESIGN.md](../../DESIGN.md). Interactive prototypes for 5 core scenarios (payment
review, 504 courier timeout, Bengali line-height 1.7 / 320px expansion, zero
accounts state, and buyer validation fallback) created in `.cache/prototypes/`.

- **Owners:** `DESIGN.md`, future surface briefs, disposable prototypes in `.cache`.
- Follow Impeccable's replacement-direction workflow. Compare distinct visual
  systems and compositions using actual order, amount, address, and status content.
- Resolve the proposed Orders/Payments/Settings hierarchy, first-run help,
  default queue, detail tabs, assistant relationship, and mobile scroll topology.
- Prototype a real review task on desktop and phone, including unknown outcome,
  long Bengali labels, no receiving accounts, and a buyer validation error.
- **Done:** a chosen direction and interaction model cover seller queue, review,
  buyer portal, and settings; record decisions and rejected trade-offs, then update
  design guidance. Do not treat this planning document as that choice.
- **Dependencies:** 01. Stop for a design decision before broad visual implementation.

## Wave B: create foundations and migrate the shell

### 03 — Tokens, primitives, and CSS ownership

- **Owners:** `frontend/src/styles/`, `index.css`, `components/`, repeated feature styles.
- Define semantic surface/text/border/action/status/focus tokens and responsive
  typography with Bengali fallback coverage. Replace legacy glow/gradient names
  only after mapping all consumers.
- Build only the demonstrated shared controls: button, field/error/help, status,
  notice, section header, empty/loading state, dialog frame, and amount display.
- Migrate one low-risk settings subsection first. Remove its obsolete declarations;
  preserve other screens until their package migrates them.
- **Proof:** component focus/error/disabled examples, computed contrast, font failure,
  320px/zoom/Bengali capture, and affected existing rendered tests. No broad snapshots
  that bless inaccessible markup or assert incidental CSS class names.
- **Done:** one clear owner per migrated style; design guidance and rendered specimens agree.
- **Dependencies:** 02. Other feature migrations reuse this foundation.

### 04 — App shell, access, setup, and navigation

Progress 2026-11-02: **complete**. Compact Modern Dhaka Shop Desk header and app shell implemented. Bulky hero masthead streamlined with responsive typography, repeat work prioritized, and compact dismissible/collapsible FirstRunGuide added. Settings subsections (Accounts, Courier, Retention) integrated in WorkspaceSectionNav and AccountsSection with backwards compatibility for unseen entry badges and existing tests. Primitives applied to setup and header actions.

- **Owners:** `App.tsx`, `Root.tsx`, `Header.tsx`, `SellerSession.tsx`, `SellerSignIn.tsx`,
  `ShopSetupForm.tsx`, `WorkspaceHeader.tsx`, `WorkspaceSectionNav.tsx`.
- Make repeat work the first useful content; provide compact first-run guidance.
  Keep locale/session controls discoverable without repeating page introductions.
- Implement chosen navigation and settings subsections; map old entry points and
  correction links. If URL navigation is selected, specify back/refresh behavior
  and retain local filter/detail state without putting secrets in URLs.
- Preserve sign-in recovery, temporary-token timing diagnostics/manual retry,
  setup idempotency/recovery, shop replacement cleanup, and public Clerk-free routing.
- **Proof:** `App`, `Root`, session, setup, locale, and unseen-entry tests; keyboard
  navigation; real hosted sign-in/recovery separately from synthetic fixtures.
- **Done:** signed-out, loading, setup, ready, expired/recovering session, and denied
  views share one understandable shell; navigation cannot erase unresolved writes.
- **Dependencies:** 03.

## Wave C: migrate core seller and buyer work

### 05 — Orders, work queues, metrics, search, and export

Progress 2026-11-02: **complete**. Recomposed seller orders desk into Modern Dhaka Shop Desk design system. Added first-class Work Query Switcher (`Needs Attention`, `Ready for Delivery`, `All Orders`) connecting to server predicates with clear banner explanation. Refactored `ShopMetricsBar` with distinct "Today in Bangladesh (Asia/Dhaka)" grouping and tabular figures (`tabular-nums`). Recomposed `OrderCard` with boarding-pass anatomy, advance/COD breakdown box, 44px touch targets, Bengali conjunct clearance (`line-height: 1.6`), and preserved mobile summary expansion. Maintained strict list/export parity across search, status, Bangladesh dates, pagination cursors, and CSV export. All 14 focused test suites (62 tests) and root checks pass.

- **Owners:** `OrderList.tsx`, `OrderCard.tsx`, `ShopMetricsBar.tsx`, date controls,
  `useSellerOrders.ts`, work-query clients, export, metrics/unseen hooks.
- Recompose the queue around identity, lifecycle, next action, advance/COD, and
  staging. Keep phone summaries concise while making the inspection action clear.
- Expose attention/preparation views using server predicates. Distinguish all-time
  backlog from today metrics and unseen-entry badges. Show active query scope and
  explain when a work query replaces ordinary date/status/search filters.
- Preserve list/export parity, cursor scope, search, Bangladesh dates, bounded
  export errors, refresh/scroll behavior, and result-count accuracy.
- **Proof:** order/mobile/date/export/work-query/metric/unseen tests; multiple pages,
  query switches during slow requests, midnight, empty results, and a long-name capture.
- **Done:** the seller can identify and open outstanding work without reading a
  dashboard hero; filter/export scope and staging meaning remain explicit.
- **Dependencies:** 04.

### 06 — Order creation, details, links, and buyer corrections

Progress 2026-11-02: **complete**. Recomposed order creation, detail modal, buyer corrections, and outcomes into the Modern Dhaka Shop Desk design system. Implemented right-docked drawer topology on desktop (>1024px) and full-screen modal sheet on mobile (<768px) with sticky boarding-pass identity and amount summary header (Agreed Total, Required/Accepted Advance, Remaining COD) in `tabular-nums`. Reorganized into 4 keyboard-navigable tabs (`Overview`, `Payment`, `Delivery`, `Buyer & link`) with focus restoration and alert jump buttons. Enhanced `CreateOrderModal` and `ParcelEarlyFields` with minimum 46px input height, 16px font-size, 44px min touch targets, and high-contrast COD calculation box. Refined `BuyerCorrection` with locked payment fields and courier booking notices on confirmed orders, `BuyerLinkAccess` with 44px touch targets and resilient retry, `BuyerLinkCopy` with fallback manual input, and `OrderOutcomes` with action guardrails. All 19 test files (90 tests) and root `npm run check` passed cleanly.

- **Owners:** `CreateOrderModal.tsx`, `OrderDetailModal.tsx`, `OrderOverview.tsx`,
  `OrderPaymentDetails.tsx`, buyer-link/correction and outcome components.
- Apply the chosen detail topology; keep contextual identity and amount summary
  visible while separating overview, payment, delivery, and buyer/link responsibilities.
- Simplify creation fields and account selection without hiding advance/COD or
  optional parcel semantics. Keep actual created-link feedback and copy failure handling.
- Preserve immutable account snapshots, link expiry/revoke/reissue, predecessor
  relationships, version conflicts, correction outcomes, and developer details disclosure.
- **Proof:** create/parcel/link/correction/outcome tests; dialog/tab keyboard and
  focus return; zero accounts, deactivated account, stale detail, and long content.
- **Done:** creation, inspection, and correction work in both locales without losing
  list context or confusing an updated buyer address with a changed courier booking.
- **Dependencies:** 05.

### 07 — Buyer confirmation and status portal

Progress 2026-11-02: **complete**. Recomposed the standalone public buyer confirmation and status portal (`/orders/:token`) into the Modern Dhaka Shop Desk design system. Implemented mobile-first centered shell (max-width 560px) with 44px min touch targets, 46px min input height, and 16px font size to eliminate iOS auto-zoom. Modernized `BuyerOrderDetails` with boarding-pass header, 3-column commercial tally (Total Bill, Advance, COD) in `tabular-nums`, and highlighted `#eaf4ee` factual receiving account card with 44px copy trigger. Structured `BuyerSubmissionForm` into 3 numbered sections (Recipient, Delivery & Courier, Advance Payment) with automatic `focusFirstError` and top error banner. Refined `PathaoLocations` with quiet cascading indicator, manual fallback, and strict preservation of retired address-AI guardrails. Polished `BuyerStatusView` across pending (amber), confirmed (emerald), expired (rose), and rejected/cancelled states with boarding-pass COD tally and 44px refresh polling button. All 13 test files (90 tests) and root `npm run check` passed cleanly.

- **Owners:** `BuyerPortal.tsx`, `BuyerOrderDetails.tsx`, `BuyerSubmissionForm.tsx`,
  contact/payment fields, `BuyerStatusView.tsx`, Pathao locations and buyer hooks.
- Lead with order terms and amounts; group contact, address/location, and payment
  claim fields. Retain editable values and focus the first local/server field error.
- Keep receiving-account copy feedback factual; do not imply that a claim or TrxID
  verifies a payment. Make submitted, pending, accepted, rejected, expired, and
  inaccessible states explain the real next action available under the contract.
- Preserve on-demand cascading location choices and quiet loading below the
  requesting dropdown; no new retry lookup, animation, or retired address-AI control.
- **Proof:** buyer validation/refresh/retry/replacement-isolation/location/locale tests;
  phone keyboard, slow network, lost submit response, changed link, and expired form.
- **Done:** a buyer can understand advance versus COD, submit once, and interpret
  the actual result; failures preserve safe recovery and written-address fallback.
- **Dependencies:** 03 and 06 for shared terms/link behavior.

### 08 — Received payments, SMS, and reconciliation

- **Owners:** `PaymentsSection.tsx`, `SmsImportPanel.tsx`, `TransactionInbox.tsx`,
  `TransactionCard.tsx`, manual recording, evidence resolution, correction/history.
- Separate entering evidence from reviewing its reconciliation outcome. Make
  recorded date versus transfer occurrence clear in filters and row metadata.
- Prioritize receipt identity/amount/account, allocation, and conflict state; open
  comparison and corrections in context rather than rendering every tool in each row.
- Preserve exact transaction identity, duplicate/conflict outcomes, account/provider
  validation, immutable evidence, allocation restrictions, and explicit exception acceptance.
- **Proof:** SMS/manual/inbox/date/comparison/resolution/correction tests; unmatched,
  identical duplicate, conflicting receipt, inactive account, and unauthorized selection.
- **Done:** users understand whether evidence was saved, allocated, conflicted, or
  accepted by exception; no screen equates a seller record with provider verification.
- **Dependencies:** 06.

## Wave D: complete delivery, assistance, and administration

### 09 — Delivery preparation, booking review, and recovery

- **Owners:** `CourierWorkspace.tsx`, parcel fields, `CourierDraft.tsx`, review/location,
  outcomes/reconciliation components, `DeliverySummary.tsx`, Pathao contracts.
- Use a visible sequence: parcel details → local draft → current review → explicit
  submit → actual result. Identify exactly what blocks the next action.
- Give unknown outcomes a dedicated reconciliation path; never present a fresh
  booking action as the ordinary remedy. Keep copyable manual delivery details.
- Preserve version/connection freshness, submit reservations, idempotency, attempt
  history, failure/noncreation evidence, and post-submission change restrictions.
- **Proof:** courier draft/review/submission/reconciliation/status-propagation tests;
  disconnect/change during review, timeout after write, repeated clicks, and known
  failure versus unknown. Live Pathao booking remains a separate controlled gate.
- **Done:** staged, reviewable, submitting, booked, failed, and unknown are visibly
  distinct; no redesign makes an unsafe repeat booking possible.
- **Dependencies:** 06 and 08.

### 10 — General assistant and contextual review assistance

- **Owners:** `AssistantWorkspace.tsx`, `AssistantWindow.tsx`, conversation hooks,
  guided order/payment components, review panels, `useConfirmedSubmission.ts`.
- Unify panel geometry and typography while retaining separate general conversation
  and selected-order/receipt context. Make local versus Gemini explanations clear.
- Preserve explicit Create order/Record payment confirmation, preview disclosures,
  processing/unknown locks, lookup, same-key retry, reset/unavailable outcomes,
  discard protection, and transient draft/chat lifetime.
- Audit opening details from the assistant, switching order/receipt, closing panels,
  navigating sections, and returning focus with a phone keyboard open.
- **Proof:** integrated assistant journeys, draft lifecycle, guided actions, selected
  preview/staleness tests; provider unavailable, stale response, session/shop switch,
  and unknown write recovery. Test provider payload minimization at the server seam.
- **Done:** manual tasks remain usable; model prose never becomes a mutation target,
  authority, automatic retry, or reason to leak sensitive draft content.
- **Dependencies:** 06 and 08; coordinate layout with 09.

### 11 — Receiving accounts, Pathao settings, and retention

- **Owners:** account forms/list, `PathaoSettings.tsx`, retention panels and APIs.
- Group settings by receiving money, delivery connection/defaults, and record
  lifecycle. Keep account activation and existing-order snapshots understandable.
- Preserve initially collapsed credential entry, sandbox/production distinction,
  write-only secrets, connection replacement effects, and actual availability states.
- Keep raw evidence cleanup distinct from structured retention; show eligibility,
  consequences, confirmations, and completed/failed results before resetting lists.
- **Proof:** account/Pathao/retention tests; missing pickup stores, denied settings,
  failed reload, connection replacement, nothing eligible, repeated cleanup, and tombstones.
- **Done:** daily work has less setup noise; destructive maintenance stays explicit
  and accessible, without reviving retired sync controls or exposing credentials.
- **Dependencies:** 04; complete after relevant core flows have migrated.

## Wave E: consolidate engineering and prove the complete product

### 12 — Request/state seams, performance, and repository cleanup

- Audit request generation/identity, pagination merges, refresh bursts, session
  changes, and temporary data lifetime at migrated seams. Fix demonstrated issues
  with focused regressions; do not add a global store as a cleanup objective.
- Profile synthetic multi-page queues and overlay opening on a constrained phone
  profile. Record request counts, bundle sizes, rendering cost, and layout shifts
  before setting budgets or choosing code splitting/virtualization.
- Remove migrated CSS, duplicate presentation helpers, and proven unreachable
  template remnants. Audit endpoint consumers before removing backend surfaces.
- Review backend route/model/service boundaries, duplicated request security/error
  handling, memory/durable parity, and changed transactional seams. Keep locking,
  atomic writes, no-store headers, authorization, and retention receipts authoritative.
- Update maintained architecture/API/audience/setup guidance to final behavior;
  preserve historical records and distinguish product capabilities from readiness.
- **Done:** fewer conflicting style owners and demonstrated request problems;
  source/test size rules hold; meaningful tests retain prior assertions.
- **Dependencies:** 05–11. Address local correctness issues earlier when discovered.

### 13 — Cross-product acceptance and staged rollout

- Execute the parent plan's device/language/state matrix and complete seller→buyer→
  payment→delivery journeys; revisit pilot tasks against the recorded baseline.
- Run focused tests per cluster, then final root `npm run check`; record exact
  commands, result JSON path, failures/skips, browser captures, and outstanding gates.
- Verify real hosted sessions, disposable PostgreSQL integration/concurrency, and
  real-device keyboards separately. Exercise real provider paths only in an
  authorized environment; never infer them from mocked successful outcomes.
- Release compatible clusters; retain reversible UI commits and explicit rollback
  steps. Recheck critical flows after deployment and preserve mutation history.
- **Done:** no critical task/comprehension/accessibility regression; every claimed
  capability has bounded evidence and an owner for any remaining external gate.
- **Dependencies:** 12 and all prior packages. No launch claim from local checks alone.
