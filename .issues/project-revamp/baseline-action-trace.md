# Baseline action trace and coverage rules

Date: 2026-11-02; application source `0d2f058`.
Parent: [baseline](baseline.md); contracts: [journey map](baseline-journeys.md).

## Exhaustive source inventory

The numbered ledger contains **515 control/handler source lines across 68 reachable
component modules**, discovered from `main.tsx` through 157 local module dependencies:
[1](baseline-actions/01.md), [2](baseline-actions/02.md),
[3](baseline-actions/03.md), [4](baseline-actions/04.md),
[5](baseline-actions/05.md), [6](baseline-actions/06.md).

Run `node .issues/project-revamp/baseline-fixture/inventory.mjs` to regenerate.
The scanner follows relative static imports and re-exports, omits explicit type-only
imports, and records native controls plus every `onX=` source line. A split JSX
control and its handler can occupy different rows; **515 is not a count of unique
user actions**. Callback props are included conservatively. It is a navigation
ledger, not an AST/call-graph proof. There are no dynamic imports in the reachable
application tree at this baseline. The generated local JSON also records direct
dependencies and tests importing each module; those are candidates, not test coverage.

For each ledger row, use its component in the table below, then the named journey
row for API, response, failure policy and specific regression owners. Inputs and
toggles have no independent endpoint: their submit/parent transition owns the write.
Native links navigate their source `href`; native summaries expand local history.
No control discovered by the scanner is silently treated as live-provider proof.

## Component → action/contract row

Paths are under `frontend/src/`; seller names omit `features/seller/`.

| Ledger component(s) | State owner and journey row / exact local behavior |
| --- | --- |
| `App`, `components/Header`, `SellerSession`, `SellerSignIn`, `WorkspaceState` | Entry → “Enter seller, sign in/out, retry session”; home/skip links navigate `/` or `#workspace`. `App.test.tsx`, `Root.test.tsx`, `SellerSession.test.tsx`. |
| `features/locale/LocaleSwitch` | `LocaleProvider`: set/persist locale, no API. `LocaleProvider.test.tsx`, `integration.test.tsx`; domain values remain unchanged. |
| `ShopSetupForm` | `useSellerBootstrap` → “Create shop / recover setup”; local name draft, submit validation, same setup key, recovery lookup. |
| `WorkspaceHeader`, `WorkspaceAccountsSummary`, `WorkspaceSectionNav`, `SellerWorkspace` | “Switch section / manage accounts” and “Refresh workspace / read metrics”; local section/modal/expanded state and parent refresh callbacks. |
| `OrderList`, `OrderDateControls`, `OrderWorkQueryBanner` | `useSellerOrders` → “Search, filter status/date, load more”; local draft search/date modes; apply/clear resets cursor and scroll; work-query dismissal restores ordinary listing. |
| `OrderExport` | “Export CSV / copy delivery summary”; GET `/seller/orders/export` with current criteria, or `/{id}/summary`; zero-count feedback, unavailable/clipboard errors; download blob is local. |
| `AttentionPreview`, `PreparationPreview` | “Find attention / preparation, show in dashboard”; refresh/page/open via work-query hooks, local dashboard callback. |
| `CreateOrderModal`, `ParcelEarlyFields` | `useOrderCreation`, `useEarlyParcelDetails` → “Generate order link”; optional early parcel pair validated before POST; cancel/Escape return focus. |
| `OrderCard`, `OrderDetailModal`, `DeveloperDetailsPanel` | “Expand phone row / inspect / change tab / close”; local expansion, review-code disclosure, support-details disclosure, roving tab focus, modal ownership. Detail external buyer link uses returned `portal_url`. |
| `BuyerLinkCopy`, `BuyerLinkAccess` | “Copy buyer link / revoke / reissue”; clipboard and expected-version mutations are separate; unknown write freezes opposite operation, stale requires fresh detail. |
| `BuyerCorrection` | “Correct buyer / inspect history”; local edits/show-details/native history disclosure, full revision-page read, versioned PATCH; confirmed claim fields stay locked. |
| `features/buyer/BuyerPortal`, `BuyerStatusView` | “Load buyer link / retry read / interpret status”; `usePublicOrder`, visible-tab polling/manual refresh, unavailable/revoked branch. |
| `features/buyer/BuyerOrderDetails` | “Copy receiving number / enter contact, address and claim”; clipboard snapshot, transient copied feedback; no mutation. |
| `features/buyer/BuyerContactFields`, `PaymentClaimFields`, `BuyerSubmissionForm` | Draft/validation → “Submit details / recover unknown submission”; contact and sender remain distinct; minor-unit conversion, field focus, frozen retry payload. |
| `features/buyer/PathaoLocations` | “Choose / clear city, zone, area; manual address”; local parent clearing/unsupported checkbox, scoped location reads; no retry lookup action. |
| `PaymentsSection`, `ManualTransactionModal` | `useManualTransaction` → “Record payment manually”; open/close local modal; field validation and optional time conversion; successful receipt reload. |
| `SmsImportPanel` | “Import SMS / previous results / enter manually”; draft/submit/reset/page results and optional manual-entry callback; per-message duplicate/conflict results. |
| `TransactionInbox`, `TransactionCard` | `useTransactionInbox` → “Search/filter/date/refresh/expand receipt”; local expansion and query scope; related-claim comparison delegates to resolution. |
| `EvidenceResolution`, `ReceiptCorrection` | `resolution.ts` → “Compare, resolve, correct evidence”; local observation/claim/reason/correction draft; used evidence locked; stale comparison refresh and frozen same-key retry. |
| `OrderPaymentDetails`, `PaymentException` | `paymentDecisions.ts` → “Select receipt / preview / accept exception”; local code/technical-ID disclosure; selection invalidates advice; blockers/reason/version guard acceptance. |
| `OrderOutcomes`, `OrderOutcomeForms`, `PaymentHistory` | “Reject / cancel / replace / show decision history”; local action/reason form, dismiss, versioned decision/replacement writes, allocation guards, fresh history and summary reads/retry. |
| `CourierWorkspace`, `CourierDraft`, `CourierReview`, `CourierReviewLocations` | “Save parcel / choose destination and pickup / review” and “Submit booking / reload current review”; local parcel/location/store drafts, version/token binding, explicit review then submit. |
| `CourierOutcomes`, `CourierReconciliation`, `CourierError` | “Attach booking / confirm noncreation”; local reference/evidence checkbox, versioned reconciliation, known failure vs unknown; error support disclosure is local. |
| `AssistantWorkspace`, `AssistantWindow`, `GuidedAssistant`, `AssistantDiscardPrompt` | `useAssistantWorkspace`, `useAssistantConversation` → “Open/close assistant; language; workflow; reset/discard”; local conversation language/draft/log, explicit discard confirmation, lock while unresolved. |
| `GuidedOrderFields`, `GuidedPaymentFields`, `GuidedOrderResult`, `GuidedPaymentResult` | “Confirm guided create/record; lookup; same-key retry”; parser edits are local; refresh accounts, context lookup, immutable keyed submission; result copy/open callbacks. |
| `ReviewAssistant`, `ReviewAssistantPanel` | “Ask AI / selected-receipt explanation / action suggestions”; advice POST on open/refresh/actions, explicit generation only, context revalidation and unavailable retry; close/Escape return focus. |
| `AccountsSection`, `AddAccountForm`, `PaymentAccountList`, `PathaoSettings` | “Add / label / activate account” and “Courier environment / connect / replace / defaults / disconnect”; local credential disclosure/environment/default drafts; secrets never echoed; expected-version conflict paths. |
| `RetentionSection`, `EvidenceRetentionPanel`, `StructuredRetentionPanel` | “Refresh / run evidence cleanup; completed-record cleanup”; separate read/cleanup endpoints, confirmation and failed-count reporting; local confirmation checkbox. |

## Supported versus unreferenced

Static entry reachability leaves `features/gemini/GeminiPlayground.tsx` and
`features/items/DataExplorer.tsx` outside the current shell. Their controls do not
belong to a supported seller/buyer journey and are excluded from the 515 rows.
This does not authorize deletion or establish that backend routes are unused.
Clerk's third-party widget internals are outside repository-owned control inventory.

## Coverage interpretation

All supported action families now have a source/contract/test trace. Browser captures
sample rendering and critical transitions; they are deliberately not exhaustive
execution of 515 source lines. Failure categories represented by existing tests
include invalid input, stale revision, unknown write, expired/denied session,
used/competing evidence, lost booking response, and immutable retry identity.
The final full repository run executes those existing tests; individual assertions
must still be read before using them as proof for a later behavior change.

Physical keyboards/devices, real Clerk, provider credentials/booking, PostgreSQL
transactions, assistive technology and pilot-user outcomes remain separate validation.
They are not silently upgraded by fixture screenshots or passing unit tests.
