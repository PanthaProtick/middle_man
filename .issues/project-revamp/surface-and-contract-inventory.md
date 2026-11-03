# Surface and contract inventory

Status: inspected planning baseline, 2026-11-02
Parent: [full revamp plan](revamp-plan.md)
Repository baseline: `0d2f058`; existing untracked skill/config/product files preserved.

## Evidence and limits

Update 2026-11-02: fresh synthetic browser captures now exist in the
[package 01 baseline](baseline.md). The historical planning evidence below remains
unchanged; the new record distinguishes captured states from outstanding coverage.

Read the current skill/context, product guidance, architecture, API index,
audience decisions, storage conventions, representative components/hooks/styles,
guided-action/review/work-query/metrics/unseen contracts, and submission API seams.
This is a project-wide planning survey, not an exhaustive code/security audit.
No external market research or competitor claims are used.

Inspected local historical images:

- `.cache/assistant-side-panel-desktop.jpg`: order/payment review and assistant.
- `.cache/delivery-layout/ready-375.png`: phone parcel/delivery review; file metadata
  places this capture on 2026-10-28, before the current source baseline.

They inform which layouts need fresh verification; they are not current goldens.
Current source already contains newer assistant and guided-action behavior, so
do not copy the historical panel composition as a specification. No fresh live
browser, hosted session, provider, physical-device, or PostgreSQL acceptance was run
to produce this plan. Visual scores and performance gains remain unmeasured.

The context launcher reported `hasVisualImplementation: false`; actual React/CSS
and historical captures demonstrate an incumbent interface. Use source evidence
rather than treating that metadata as proof of a greenfield project.

## Surface owners and required preservation

Paths below are relative to `frontend/src/` unless otherwise stated.

| Surface | Current owners | Revamp concern |
| --- | --- | --- |
| Entry/providers | `main.tsx`, `Root.tsx`, `App.tsx` | Public buyer path, locale/session lifetime, shell hierarchy. |
| Seller identity/setup | `features/seller/SellerSession.tsx`, `SellerSignIn.tsx`, `ShopSetupForm.tsx` | Real sign-in boundary, recovery, setup errors, offline standby. |
| Workspace/navigation | `SellerWorkspace.tsx`, `WorkspaceHeader.tsx`, `WorkspaceSectionNav.tsx` under seller | Daily action hierarchy, query context, setup/settings placement. |
| Metrics/badges | Seller `ShopMetricsBar.tsx`, `useTodayMetrics.ts`, `useUnseenEntries.ts` | Today/loaded/queue/unseen scopes must stay distinct. |
| Order queue/query/export | Seller `OrderList.tsx`, `OrderCard.tsx`, `useSellerOrders.ts`, `OrderDateControls.tsx`, `OrderExport.tsx` | Search, work-query exclusivity, pagination, scroll, amount/status hierarchy. |
| Creation/details | Seller `CreateOrderModal.tsx`, `OrderDetailModal.tsx`, `OrderOverview.tsx`, `OrderPaymentDetails.tsx` | Validation, account snapshots, focus/tab behavior, long content. |
| Buyer links/corrections | Seller `BuyerLinkAccess.tsx`, `BuyerLinkCopy.tsx`, `BuyerCorrection.tsx`, outcome components | Expiry/reissue/revoke, actual link results, stale versions and revisions. |
| Buyer terms/submission | Buyer `BuyerPortal.tsx`, `BuyerOrderDetails.tsx`, `BuyerSubmissionForm.tsx`, contact/payment fields | Terms first, preserved fields, exact claim meaning, isolated portal sessions. |
| Buyer locations/status | Buyer `PathaoLocations.tsx`, `useLocationCatalog.ts`, `usePublicOrder.ts`, `useBuyerSubmission.ts`, `BuyerStatusView.tsx` | Cascading request identity, manual fallback, refresh/retry, terminal/gated states. |
| Payments/SMS | Seller `PaymentsSection.tsx`, `TransactionInbox.tsx`, `TransactionCard.tsx`, `SmsImportPanel.tsx`, `ManualTransactionModal.tsx` | Evidence entry versus reconciliation, date semantics, duplicate/conflict outcomes. |
| Evidence decisions | Seller `EvidenceResolution.tsx`, `ReceiptCorrection.tsx`, `PaymentException.tsx`, `PaymentHistory.tsx` | Ownership, allocations, blockers, explicit acceptance and correction history. |
| Courier work | Seller `CourierWorkspace.tsx`, `CourierDraft.tsx`, `CourierReview.tsx`, `CourierReconciliation.tsx`, outcomes | Reviewed submission and recoverable, distinct attempt states. |
| Assistant | Seller `AssistantWorkspace.tsx`, `AssistantWindow.tsx`, conversation/guided/review components and hooks | Transient data, selected context, local guidance, explicit writes, focus topology. |
| Accounts/integration | Seller `AccountsSection.tsx`, `PaymentAccountList.tsx`, `AddAccountForm.tsx`, `PathaoSettings.tsx` | Receiving-account snapshots, private credentials, connection/environment/default state. |
| Retention | Seller `RetentionSection.tsx`, `EvidenceRetentionPanel.tsx`, `StructuredRetentionPanel.tsx` | Consequences, confirmation, eligible data, mutation tombstones. |
| Locale | `features/locale/`, including Clerk localization and formatting | Preserve typed presentation, raw identifiers, locale choice and form state. |
| Styling/shared UI | `index.css`, `styles/`, feature CSS, `components/` | Replace cascade layering with explicit owners; audit inline visual rules. |
| Legacy/template | `features/items/`, `features/gemini/`, `styles/demo.css`, backend template routes | Audit actual consumers before deletion; do not reintroduce Demo & Tools navigation. |

## Contract reading map for implementers

These are source pointers, not permission to change business behavior.

- [Product truth](../../PRODUCT.md), [current design system](../../DESIGN.md),
  [audience decisions](../../docs/ui-audience-and-design.md).
- [Architecture](../../docs/ARCHITECTURE.md), [API index](../../docs/API_CONTRACTS.md),
  [repository conventions](../../docs/CONVENTIONS.md).
- [Orders/search/export](../../docs/contracts/orders-search-and-export.md),
  [attention](../../docs/contracts/attention-query.md),
  [preparation](../../docs/contracts/delivery-preparation-query.md).
- [Daily metrics](../../docs/contracts/daily-shop-metrics.md),
  [unseen entries](../../docs/contracts/unseen-entries.md).
- [Payments/reconciliation](../../docs/contracts/payments-and-reconciliation.md),
  [guided orders](../../docs/contracts/guided-order-creation.md),
  [guided payments](../../docs/contracts/guided-transaction-entry.md).
- [Review assistance](../../docs/contracts/review-assistance.md),
  [buyer access/corrections](../../docs/contracts/buyer-access-and-corrections.md).
- [Courier overview](../../docs/contracts/pathao-and-courier.md),
  [Pathao account](../../docs/pathao-account-contract.md),
  [locations](../../docs/pathao-location-contract.md),
  [review](../../docs/pathao-review-contract.md),
  [submission](../../docs/pathao-submission-contract.md).
- [Retention/AI/retired surfaces](../../docs/contracts/retention-ai-and-retired-surfaces.md),
  [retention lifecycle](../../docs/retention-lifecycle.md), [SMS](../../docs/sms-import.md).

## Backend seams to trace before engineering changes

- `backend/app/api/order_submissions.py`, `transaction_submissions.py`, and
  `frontend/src/features/seller/useConfirmedSubmission.ts`: explicit mutation,
  storage epoch, lookup/replay, frozen payload, and unknown-outcome recovery.
- `backend/app/api/work_queries.py`, `order_export.py`, and corresponding services:
  shared queue membership/order/export semantics and shop authorization.
- `backend/app/api/review_assistance.py` and generation services: private responses,
  selected receipt ownership, minimized facts, provider context, and freshness.
- Courier routers/services: drafts, reservation, reviewed submission, attempts,
  reconciliation, and version checks remain separate responsibilities.
- `backend/app/services/pathao_snapshot_sync.py`: synchronization is retired;
  no-op entry points do not authorize restoring crawlers during cleanup.
- Existing backend memory/database adapters and tests: evaluate only changed seams;
  standby behavior does not establish production durability or concurrent correctness.

## Planning verification

- Application source, tests, backend contracts, and existing design files are unchanged.
- Relative links: passed for all three planning files.
- Size review: plan 213 lines, roadmap 225 lines, inventory below 250 lines.
- `npm run conventions`: passed; 1,018 tracked files checked, with 31 existing
  files reported at the 250-line review trigger. The new plans are untracked,
  so their links and sizes were checked separately as recorded above.
- Root `npm run check` is required for future implementation packages; it is not a
  substitute for rendered acceptance. It was not run for this documentation-only task.
