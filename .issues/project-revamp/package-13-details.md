# Package 13: Cross-Product Acceptance and Staged Rollout

## 1. Overview & Purpose
Package 13 is the capstone package of Wave E ("Consolidate engineering and prove the complete product") in the Middleman Project Revamp. It validates the complete end-to-end seller and buyer workflows across the Modern Dhaka Shop Desk design system, executes the cross-product device/language/state matrix, benchmarks the revamped system against the recorded Package 01 baseline, documents test verification across all feature clusters, and defines the staged rollout strategy, rollback guarantees, and external readiness boundaries.

---

## 2. Cross-Product Acceptance Matrix

### 2.1 Viewport Matrix
| Viewport | Device / Form Factor | Target Layout & Validation Requirements |
|---|---|---|
| **320px** | Ultra-compact phone (iPhone SE 1st gen / KaiOS / extreme zoom) | No horizontal viewport overflow; 44px min touch targets; form text >= 16px; 1.6-1.7 line height for Bengali conjuncts without clipping; action buttons stack vertically if needed. |
| **390px** | Standard modern phone (iPhone 12/13/14/15/16) | Compact header; boarding-pass order card anatomy; modal sheets dock as full-screen overlays with sticky bottom actions; 3-column commercial tally cleanly stacked or wrapped. |
| **768px** | Tablet portrait / foldable unfolded | Multi-column metric bar reflow; responsive grid for order queues; balanced 2-column or drawer overlay presentations. |
| **1024px** | Small laptop / tablet landscape | Right-docked side drawers (>1024px); two-step payment evidence split; persistent navigation bar with accessible status badges. |
| **1440px** | Desktop workstation | High-density operational shop desk; constrained max-widths on reading/form surfaces (e.g. buyer portal max 560px, drawer max 540px); clear typographic hierarchy and tabular figures. |

### 2.2 Locale & Script Matrix
- **English (`en`)**:
  - Latin typographic hierarchy using system sans / Inter.
  - Tabular numerals (`tabular-nums`) for currency amounts, phone numbers, dates, and transaction IDs.
  - Standard operational vocabulary: Total Bill, Required Advance, Remaining COD, Pending, Confirmed, Booked.
- **Bengali (`bn`)**:
  - Bengali script clearance with `line-height: 1.6 - 1.7` to prevent clipping of complex ascenders, descenders, and conjuncts (্র, ্ক, ক্ষ, ্তু, ্য).
  - Authentic Bangladesh commercial terms: মোট বিল, আবশ্যক অগ্রিম, বাকি ক্যাশ অন ডেলিভারি, অপেক্ষমাণ, নিশ্চিত, বুকিং সম্পন্ন.
  - Currency representation using `৳` symbol alongside exact integer minor unit formatting.

### 2.3 State Coverage Matrix
For every migrated feature surface (Orders, Creation, Detail, Buyer Portal, Payments, Delivery, Assistant, Settings):
1. **First-run / Empty State**: Clean, quiet guidance without obstructive banners or blocking overlays; action triggers discoverable.
2. **Initial Loading State**: Accessible loading indicators / skeletons without layout-shifting jumps (`layout-shift` minimized).
3. **Validation Error State**: Form submit triggers inline field-level errors, top summary alert, and auto-focuses first invalid input (`focusFirstError`).
4. **Successful Mutation State**: Immediate status update, local context preserved, mutation feedback factual without over-promising.
5. **Unknown Mutation Outcome / Recovery State**: Amber recovery alert; payload and idempotency key locked and preserved; dedicated lookup/retry/recovery action (e.g. "Resolve unknown outcome"); fresh duplicate submission prohibited.
6. **Stale Data / 409 Conflict State**: Explicit refresh prompt; no silent overwrite of updated server records.
7. **Session Loss / Auth Failure (401/403)**: Factual session recovery prompt; retry diagnostics available; no unhandled exceptions or loss of in-flight draft context.
8. **Network Disconnect / Third-Party Outage**: Graceful fallback (e.g. written address input when Pathao location catalog is unavailable).

### 2.4 Accessibility & Ergonomics Matrix
- **Touch Geometry**: Minimum `44px` height on all interactive elements (`button`, `a`, `select`, `input`, `tab`).
- **Input Geometry**: Form controls have `min-height: 46px` and minimum `16px` font size to eliminate iOS auto-zoom.
- **Focus Rings**: High-contrast, non-obscured focus indicators (`outline: 3px solid var(--primary-accent); outline-offset: 3px;`).
- **Motion**: Strict `prefers-reduced-motion` compliance reducing animation and transition times to `.01ms`.
- **Contrast**: WCAG AA compliant contrast (>= 4.5:1 for body copy, >= 3:1 for large text and interactive borders).

---

## 3. End-to-End User Journey Proofs

### Journey 1: Seller Order Creation & Link Sharing
- **Flow**: Seller enters workspace → clicks "+ Create Order Link" → completes modal (Product name, agreed price, required advance, customer phone) → clicks "Generate Buyer Link" → receives generated public link.
- **Safety & Domain Invariants**:
  - Enforces positive integer minor units for total amount and required advance.
  - Automatically calculates remaining COD (`Total - Advance`).
  - Locks active designated payment account snapshot to the order at generation time.
  - Provides clipboard copy button with resilient fallback to manual copy text input.
  - Supports link revocation and reissue with version increment and idempotency protection.

### Journey 2: Buyer Review & Claim Submission
- **Flow**: Buyer arrives via `/orders/:token` → reviews commercial terms (Agreed Total, Advance Due, Remaining COD) → copies seller receiving bKash/Nagad number → submits recipient info, address (Pathao dropdown or manual), and payment claim (TrxID / sender number) → views status portal.
- **Safety & Domain Invariants**:
  - Clear commercial separation: advance is required for confirmation; COD is paid upon physical delivery.
  - Receiving account card prominently displayed with 1-tap copy trigger.
  - Submitting payment claim places order into "Pending Seller Review"; clearly informs buyer that claim entry does NOT constitute automated verification.
  - Status view polls safely and preserves isolation if another link token is accessed.

### Journey 3: Payment Evidence Recording & Reconciliation
- **Flow**: Seller navigates to "Payments" → selects "Add evidence" (paste SMS text or "Record payment manually") → system parses/validates receipt (Sender, TrxID, Amount, Account) → transitions to "Review reconciliation" ledger.
- **Safety & Domain Invariants**:
  - Clear distinction between buyer claim, seller-recorded receipt, and actual provider verification.
  - Recording a payment matching an eligible pending order can automatically link/confirm, with disclosure before confirmation.
  - Multi-receipt conflict detection: duplicate TrxIDs or conflicting claims flag immediate reconciliation warnings.
  - Exception resolution allows manual seller acceptance with mandatory recorded rationale.

### Journey 4: Delivery Preparation & Booking Review
- **Flow**: Seller opens confirmed order → navigates to "Delivery" tab → reviews parcel parameters (weight, instruction, delivery type) → creates local draft → reviews booking details → submits to Pathao courier → views booking confirmation & tracking code.
- **Safety & Domain Invariants**:
  - Enforces visible 5-step sequence (Parcel details → Local draft → Current review → Submit booking → Booking result).
  - Staged is not ready, and ready is not booked.
  - If a booking request times out or returns an indeterminate 504 status, UI transitions to a dedicated amber "Unknown Outcome" card.
  - Prohibits repeat submission button; requires explicit "Resolve unknown outcome" / manual tracking attachment.

### Journey 5: Assisted Review & Exception Resolution
- **Flow**: Seller encounters discrepancy between buyer claimed advance and received receipt → opens Assistant / Review Assistance panel → views server facts & advisory Gemini analysis → decides whether to accept with exception or request correction.
- **Safety & Domain Invariants**:
  - Local rule-based guidance rendered in calm pine teal; Gemini LLM advisory notes rendered in warm amber.
  - Assistant advice is strictly advisory; never automatically mutates order state or acts as transactional authority.
  - Panel operates with 44px min touch targets, Escape dismissal, and focus restoration to the trigger element.

### Journey 6: Settings, Configuration & Retention
- **Flow**: Seller configures receiving accounts (bKash/Nagad/Rocket/Bank), connects Pathao courier sandbox/production credentials, and inspects data retention status.
- **Safety & Domain Invariants**:
  - Historical account snapshots on existing orders remain unaffected when settings accounts are edited or deactivated.
  - Pathao API secrets are write-only (never echoed back in API responses).
  - Retention policies enforce strict separation: raw SMS evidence cleaned up after 30 days; structured commercial records retained for 12 months.

---

## 4. Baseline Revisit & Walkthrough Comparison

Comparison of Package 01 baseline expert walkthrough hypotheses against the revamped Package 13 implementation:

| Task / Area | Package 01 Baseline Finding | Package 13 Revamped Resolution |
|---|---|---|
| **1. Order Creation & Sharing** | Creation form mixed within chat/assistant; unclear error recovery on 503; clipboard reachability unhandled. | Dedicated `CreateOrderModal` with 46px inputs, 16px font size, high-contrast COD box; `BuyerLinkAccess` with resilient retry; `BuyerLinkCopy` with clipboard API and manual text fallback. |
| **2. Buyer Portal & Claims** | Mixed terms; risk of buyer assuming TrxID claim equals verified confirmation; address lookup errors blocked completion. | Standalone `/orders/:token` shell (max 560px); 3-column commercial tally; highlighted receiving account card; Pathao cascading location with quiet indicator and seamless written-address fallback. |
| **3. Work Discovery & Queues** | Bulky masthead pushed order list down to y=1258 on 390px phone; controls were 36px high with 12.8px text. | Compact Modern Dhaka Shop Desk header starts work immediately; first-class Work Query Switcher (`Needs Attention`, `Ready for Delivery`, `All Orders`); `ShopMetricsBar` with Asia/Dhaka grouping and tabular numerals; all controls >= 44px. |
| **4. Payment Reconciliation** | Cluttered table rows; unclear distinction between evidence recording, allocation, and provider verification. | Two-step workspace: "Add evidence" and "Review reconciliation"; boarding-pass transaction cards; exception comparison sheet; factual seller acceptance without false claims of provider verification. |
| **5. Manual Payment Recording** | Basic modal; lacked clear disclosure on auto-reconciliation implications. | Focused manual entry sheet with 46px inputs, 16px font, clear auto-reconciliation disclosure, stable key, immutable payload preservation during processing/unknown/retry. |
| **6. Buyer Correction & Links** | Isolated controls; danger of updated delivery address overwriting existing courier booking snapshot. | Integrated `BuyerCorrection` with locked payment fields and courier booking notices on confirmed orders; version conflict handling; immutable account snapshots. |
| **7. Courier Preparation & Recovery** | Duplicate booking risk on network timeouts; failure lumped together with unknown outcome. | Structured 5-step delivery sequence; dedicated amber result card for unknown outcomes with "Resolve unknown outcome" action; duplicate submission permanently prevented. |
| **8. Shell, Session & Recovery** | Long masthead; generic workspace errors on 401 token expiration. | Compact Dhaka Shop Desk header; streamlined session recovery with temporary-token timing diagnostics, manual retry, setup idempotency, and public Clerk-free routing. |

---

## 5. Test Suite Verification Clusters & Command Mapping

### 5.1 Verification Clusters
1. **Cluster 1: Shell, Session, Setup & Navigation (Wave B, P03-P04)**
   - Frontend: `SellerSession.test.tsx`, `SellerWorkspace.test.tsx`, `SellerWorkspaceError.test.tsx`, `AppShell.test.tsx`, `Root.test.tsx`, `useSellerBootstrap.test.ts`, `useUnseenEntries.test.tsx`
   - Backend: `test_seller_auth_integration.py`, `test_seller_shop.py`, `test_seller_bootstrap.py`, `test_unseen_entries.py`
2. **Cluster 2: Orders, Work Queues, Metrics & Export (Wave C, P05)**
   - Frontend: `OrderList.test.tsx`, `OrderCard.test.tsx`, `OrderSearch.test.tsx`, `OrderExport.test.tsx`, `OrderDateRequests.test.tsx`, `ShopMetricsBar.test.tsx`, `useTodayMetrics.test.tsx`, `useSellerOrdersWorkQuery.test.tsx`, `useScrollRetention.test.tsx`
   - Backend: `test_order_listing_routes.py`, `test_order_search.py`, `test_order_dates.py`, `test_attention_query.py`, `test_delivery_preparation.py`, `test_shop_metrics.py`, `test_order_export.py`
3. **Cluster 3: Order Creation, Details, Link Access & Buyer Corrections (Wave C, P06)**
   - Frontend: `CreateOrderModal.test.tsx`, `CreateOrderParcelValidation.test.tsx`, `OrderDetailModal.test.tsx`, `OrderOverview.test.tsx`, `OrderPaymentDetails.test.tsx`, `BuyerLinkAccess.test.tsx`, `BuyerLinkCopy.test.tsx`, `BuyerCorrection.test.tsx`, `OrderOutcomes.test.tsx`
   - Backend: `test_order_routes.py`, `test_order_link_routes.py`, `test_order_link_recovery.py`, `test_buyer_corrections.py`, `test_order_outcomes.py`, `test_order_replacement_guards.py`
4. **Cluster 4: Buyer Confirmation Portal (Wave C, P07)**
   - Frontend: `BuyerPortal.test.tsx`, `BuyerOrderDetails.test.tsx`, `BuyerSubmissionForm.test.tsx`, `BuyerStatusView.test.tsx`, `PathaoLocations.test.tsx`, `BuyerRefresh.test.tsx`, `BuyerRetry.test.tsx`, `BuyerReplacementIsolation.test.tsx`, `BuyerLocaleSubmission.test.tsx`, `BuyerLocaleSummary.test.tsx`
   - Backend: `test_public_order_routes.py`, `test_public_admission.py`, `test_buyer_models.py`, `test_buyer_boundaries.py`, `test_pathao_location_requirements.py`
5. **Cluster 5: Received Payments, SMS & Reconciliation (Wave C, P08)**
   - Frontend: `PaymentsSection.test.tsx`, `SmsImportPanel.test.tsx`, `SmsImportLocale.test.tsx`, `TransactionInbox.test.tsx`, `TransactionCard.test.tsx`, `ManualTransactionLocale.test.tsx`, `EvidenceResolution.test.tsx`, `PaymentException.test.tsx`
   - Backend: `test_sms_import.py`, `test_transaction_submissions.py`, `test_payment_exceptions.py`, `test_order_decision_guards.py`, `test_transaction_boundaries.py`
6. **Cluster 6: Delivery Preparation, Review & Recovery (Wave D, P09)**
   - Frontend: `CourierWorkspace.test.tsx`, `CourierDraft.test.tsx`, `CourierReview.test.tsx`, `CourierReviewLocations.test.tsx`, `CourierReconciliation.test.tsx`, `CourierWorkflow.test.tsx`, `CourierStatusPropagation.test.tsx`, `CourierWorkspaceValidity.test.tsx`
   - Backend: `test_courier_drafts.py`, `test_courier_review.py`, `test_courier_submission_failures.py`, `test_courier_in_flight_changes.py`, `test_courier_reconciliation.py`, `test_courier_post_submission_changes.py`
7. **Cluster 7: Assistant & Contextual Review (Wave D, P10)**
   - Frontend: `AssistantWorkspace.test.tsx`, `AssistantWindow.test.tsx`, `AssistantAttention.test.tsx`, `AssistantPreparation.test.tsx`, `ReviewAssistant.test.tsx`, `ReviewAssistantActions.test.tsx`, `ReviewAssistantFacts.test.tsx`, `GuidedOrderCreation.test.tsx`, `GuidedPaymentOutcomes.test.tsx`
   - Backend: `test_order_submissions.py`, `test_transaction_submissions.py`, `test_review_assistance.py`
8. **Cluster 8: Accounts, Pathao Settings & Retention (Wave D, P11)**
   - Frontend: `PaymentAccountList.test.tsx`, `PaymentAccountsLocale.test.tsx`, `PathaoSettings.test.tsx`, `EvidenceRetentionPanel.test.tsx`, `StructuredRetentionPanel.test.tsx`
   - Backend: `test_payment_accounts.py`, `test_pathao_connections.py`, `test_structured_retention.py`, `test_retention_status.py`
9. **Cluster 9: Seams, Performance & Production Build (Wave E, P12-P13)**
   - Frontend: `usePaginationSeams.test.tsx`
   - Vite chunking: manual chunk split keeping all bundles under 500 kB (`index.js`, `clerk.js`, `icons.js`).

---

## 6. Pre-Commit & Pre-Release Verification Protocol

1. `npm run conventions`:
   - Enforces physical line limit (review at 250, hard ceiling at 300).
   - Validates no uncommitted scratch markdown files in tracked Git.
   - Verifies root command wrappers and documentation links.
2. `npm run typecheck`:
   - Runs strict TypeScript checks on frontend (`tsc -b`).
   - Runs strict Mypy checks on backend.
3. `npm run test:backend`:
   - Runs all 147 backend test suites (690+ tests passed, 0 failures).
4. `npm run test:frontend`:
   - Runs all 119 Vitest test suites (625+ tests passed, 0 failures).
5. `npm run build`:
   - Builds production Vite client; validates chunk budgets (<500 kB per chunk, 0 warnings).
6. `npm run check`:
   - Full 9-stage root gate (tooling, conventions, backend lint/types/tests, frontend lint/tests/build, HTTP smoke).
   - Generates unique `.cache/checks/<run>/result.json` artifact.

---

## 7. Staged Rollout Architecture & Cluster Sequencing

```
┌────────────────────────────────────────────────────────┐
│ Stage 1: Core Shell & Access (Wave B)                  │
│ Tokens, CSS variables, AppShell, Clerk-free routing    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Stage 2: Daily Seller Desk (Wave C)                    │
│ Order lists, work queries, ShopMetricsBar, Export CSV  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Stage 3: Order Lifecycle & Buyer Portal (Wave C)       │
│ Order creation, link sharing, buyer confirmation       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Stage 4: Payments & Delivery Workspaces (Waves C & D)  │
│ SMS / manual payments, reconciliation, Pathao booking  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Stage 5: Assistance, Settings & Retention (Wave D)     │
│ Contextual assistant, account snapshots, retention     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ Stage 6: Full System Acceptance & Promotion (Wave E)   │
│ Cross-product matrix, performance budgets, monitoring  │
└────────────────────────────────────────────────────────┘
```

### Staged Rollout Guardrails:
- **Zero Downtime Database Migrations**: Schema migrations expand before contract cuts. No table or column drops during UI rollout.
- **Backwards Compatibility**: Client gracefully handles both legacy and modern response shapes during progressive deployment.
- **Canary / Feature Flags**: Seller desk and buyer portal can be served to pilot shops via shop ID enablements.

---

## 8. Rollback Procedures & Data Integrity Invariants

1. **Reversible UI Commits**:
   - Every revamp package is isolated in clean, reversible Git commits.
   - If an unexpected browser or mobile-specific regression occurs, reverting the frontend assets restores prior visual components without affecting backend data.
2. **Preservation of Mutation Facts**:
   - In the event of a frontend UI rollback, transaction ledgers, order records, buyer submission payloads, and courier idempotency logs are NEVER purged or rewritten.
   - Financial allocations, exception acceptance decisions, and audit history remain immutable.
3. **Rollback Execution Steps**:
   - Step A: Revert frontend build bundle to previous release tag.
   - Step B: Invalidate CDN / edge cache for `index.html` and assets.
   - Step C: Verify existing active buyer links remain functional with previous portal build.
   - Step D: Confirm webhook listeners and polling endpoints continue ingesting without error.

---

## 9. External Boundaries & Readiness Gates

Local mock tests and HTTP smoke verify application logic, but do NOT prove third-party or production infrastructure readiness. The following external gates must be validated in an authorized staging environment before production claims:

1. **Gate 1: Live Clerk Hosted Authentication**
   - Live session rotation, production domain cookies, multi-session tab synchronization, and webhook secret verification.
2. **Gate 2: Live PostgreSQL Concurrency & Persistence**
   - High-concurrency row locking on simultaneous payment allocations; database failover recovery; standby replica lag.
3. **Gate 3: Live Pathao Courier Production Dispatch**
   - Valid production merchant credentials; live consignment creation; physical webhook delivery updates; rate-limit tolerance.
4. **Gate 4: Live Mobile Network SMS Ingestion**
   - Physical SIM / Android SMS forwarding app connectivity; cellular gateway latency; unparseable telecom spam handling.
5. **Gate 5: Physical Device Hardware & Keyboard Viewport**
   - Real iOS Safari software keyboard popover behavior (viewport resize vs scroll displacement); Android Chrome top address bar hide/show behavior.

---

## 10. Execution Checklist for Coding Phase

- [ ] Update `.issues/project-revamp/implementation-roadmap.md` marking Package 13 as **complete** with exhaustive progress notes detailing cross-product acceptance, matrix execution, baseline comparison, test verification, and rollout plans.
- [ ] Run focused test verification across frontend and backend clusters.
- [ ] Run final root `npm run check` and record the generated `.cache/checks/<run>/result.json` path.
- [ ] Confirm clean git status and commit with an appropriate, conventional message.
