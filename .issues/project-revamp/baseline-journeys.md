# Current journey and contract map

Date: 2026-11-02; source `0d2f058`; [baseline evidence](baseline.md).
Paths below are relative to `frontend/src/features/` unless prefixed otherwise.
`S` means `seller/`; `B` means `buyer/`. API paths start with `/api`.
This maps action groups. The completed [control ledger](baseline-action-trace.md)
and [walkthrough supplement](baseline-walkthroughs.md) supersede the initial-round
capture gaps noted in the tables. A visible fixture control is not backend write proof.

## Entry and work discovery

| Action / transition | Component → state owner → API | Response, failure and existing proof owner |
| --- | --- | --- |
| Enter seller, sign in/out, retry session | `Root.tsx` → `S/SellerSession.tsx` → Clerk/session request binding | Token failure/rejection/clock recovery notice; session-key remount and token rotation are distinct. `S/SellerSession.test.tsx`; `backend/tests/test_seller_auth_integration.py`. Clerk bypassed in fixture. |
| Create shop / recover setup | `S/ShopSetupForm.tsx` → `S/useSellerBootstrap.ts` → GET/POST `/seller/shop` | `ShopStatus`; stable setup key, name validation, recovery lookup and retry. `S/SellerWorkspace.test.tsx`, `S/SellerWorkspaceError.test.tsx`. Only initial setup rendered. |
| Switch section / manage accounts | `S/WorkspaceSectionNav.tsx`, `S/WorkspaceAccountsSummary.tsx` → `S/SellerWorkspace.tsx` | Local orders/payments/accounts/retention state; no router added. Unseen timestamps are not work counts. `S/useUnseenEntries.test.tsx`. All four sections rendered. |
| Refresh workspace / read metrics | `S/WorkspaceHeader.tsx`, `S/ShopMetricsBar.tsx` → bootstrap, `useTodayMetrics`, `useUnseenEntries` | GET `/seller/metrics/today`, `/seller/unseen-entries`; missing metrics are unavailable rather than zero. `S/useTodayMetrics.test.tsx`, `S/useUnseenEntries.test.tsx`; `backend/tests/test_shop_metrics.py`. |
| Search, filter status/date, load more | `S/OrderList.tsx` → `S/useSellerOrders.ts` → GET `/seller/orders` | Scoped cursor, request generation and clear-versus-refresh behavior; `S/OrderSearch.test.tsx`, `S/useSellerOrdersWorkQuery.test.tsx`, `S/useScrollRetention.test.tsx`; `backend/tests/test_order_listing_routes.py`, `test_order_search.py`, `test_order_dates.py`. Fixture does not emulate query semantics. |
| Find attention / preparation, show in dashboard | Assistant → `S/useAttentionQuery.ts`, `S/usePreparationQuery.ts` → GET `/seller/work-queries/attention`, `/preparation` | Server total/reasons/cursor; applying a work query replaces ordinary filters. `S/AssistantAttention.test.tsx`, `S/AssistantPreparation.test.tsx`; `backend/tests/test_attention_query.py`, `test_delivery_preparation.py`. Ordinary list screenshots do not prove these previews. |
| Export CSV / copy delivery summary | `S/OrderExport.tsx` → export client → seller export route | Explicit export scope, bounded errors; manual delivery aid, not courier booking. `S/OrderExport.test.tsx`; `backend/tests/test_order_export.py`, `test_order_export_dates.py`. No download exercised. |

## Create, collect and inspect

| Action / transition | Component → state owner → API | Response, failure and existing proof owner |
| --- | --- | --- |
| Generate order link | `S/CreateOrderModal.tsx` → `S/useOrderCreation.ts` → POST `/seller/orders` | `SellerOrder` with actual portal URL; exact amount/account/parcel validation, stable key, field errors. `S/CreateOrderModal.test.tsx`, `S/CreateOrderParcelValidation.test.tsx`; `backend/tests/test_order_routes.py`. Form and empty validation captured, no write. |
| Expand phone row / inspect / change tab / close | `S/OrderCard.tsx` → `S/OrderDetailModal.tsx` | Phone summaries expand; modal tabs, Escape, focus return and nested assistant dismissal. `S/SellerWorkspace.test.tsx`, `S/AssistantWorkspace.test.tsx`, `S/CourierStatusPropagation.test.tsx`. Overview/payment/delivery rendered; focus-return matrix remains. |
| Copy buyer link / revoke / reissue | `S/BuyerLinkCopy.tsx`, `S/BuyerLinkAccess.tsx` → clipboard; POST `/seller/orders/{id}/revoke-link`, `/reissue-link` | Copy failure versus actual returned link; expected version and idempotency. `S/BuyerLinkCopy.test.tsx`, `S/BuyerLinkAccess.test.tsx`; `backend/tests/test_order_link_routes.py`, `test_order_link_recovery.py`. Writes uncaptured. |
| Load buyer link / retry read / interpret status | `B/BuyerPortal.tsx` → `B/usePublicOrder.ts` → GET `/public/orders/{token}` | `PublicOrder`; admission/expiry/revocation/replacement isolation; status polling. `B/BuyerPortal.test.tsx`, `B/BuyerRefresh.test.tsx`, `B/BuyerReplacementIsolation.test.tsx`; `backend/tests/test_public_order_routes.py`, `test_public_admission.py`. Form and selected terminal/read-error states captured. |
| Copy receiving number / enter contact, address and claim | `B/BuyerOrderDetails.tsx`, `B/BuyerSubmissionForm.tsx` → draft/validation owners | Actual account snapshot; separate sender/contact; integer minor units; field errors/focus. `B/BuyerLocaleSummary.test.tsx`, `B/BuyerLocaleSubmission.test.tsx`, `backend/tests/test_buyer_models.py`. Empty-submit focus verified. |
| Choose / clear city, zone, area; manual address | `B/PathaoLocations.tsx` → `B/useLocationCatalog.ts` → GET `/public/orders/{token}/pathao-locations` | Parent-scoped choices/version, descendant clearing, disconnected/error fallback. No lookup-retry control. `B/PathaoLocations.test.tsx`, `B/PathaoPending.test.tsx`; `backend/tests/test_pathao_location_requirements.py`. Disconnected state rendered; cascade interaction pending. |
| Submit details / recover unknown submission | `B/useBuyerSubmission.ts` → POST `/public/orders/{token}/submission`, then status read | Frozen payload/key during unknown outcome; field errors allow correction; pending/confirmed are actual response states. `B/BuyerRetry.test.tsx`, `B/BuyerReplacementIsolation.test.tsx`; `backend/tests/test_buyer_boundaries.py`. Initial status fixtures do not prove a successful submit. |
| Correct buyer / inspect history | `S/BuyerCorrection.tsx` → `S/corrections.ts` → GET order/history; PATCH `/seller/orders/{id}/buyer-details` | Version/revision conflict, immutable account, paged history, updated local delivery versus booked snapshot. `S/BuyerCorrection.test.tsx`; `backend/tests/test_buyer_corrections.py`, `test_courier_post_submission_changes.py`. Conditional controls still need captures. |

## Payment evidence and decisions

| Action / transition | Component → state owner → API | Response, failure and existing proof owner |
| --- | --- | --- |
| Record payment manually | `S/ManualTransactionModal.tsx` → `S/useManualTransaction.ts` → POST `/seller/transactions` | `ReceiptView`; validation, field focus, stable key, reload; receipt recording may reconcile an eligible order. `S/ManualTransactionLocale.test.tsx`; `backend/tests/test_transaction_submissions.py`, `test_order_routes.py`. Form captured; write/disclosure acceptance pending. |
| Import SMS / previous results / enter manually | `S/SmsImportPanel.tsx` → `S/api.ts` → POST `/seller/transactions/sms-import`, GET `/sms-imports` | Per-message result/duplicate/conflict, size/count bounds, account scope, raw retention deadline. `S/SmsImportPanel.test.tsx`, `S/SmsImportLocale.test.tsx`; `backend/tests/test_sms_import.py`. Initial import UI captured. |
| Search/filter/date/refresh/expand receipt | `S/TransactionInbox.tsx`, `TransactionCard.tsx` → `useTransactionInbox.ts` → GET `/seller/transactions` | Recorded-date scope, query reset/pagination, observations and allocation state. `S/TransactionSearch.test.tsx`, `S/TransactionDates.test.tsx`, `S/TransactionInboxViewport.test.tsx`. Initial unmatched row captured. |
| Compare, resolve, correct evidence | `S/EvidenceResolution.tsx`, `ReceiptCorrection.tsx` → `S/resolution.ts` → GET/PATCH `/seller/transactions/{id}`, POST `/{id}/resolve` | `ReceiptComparison`; expected versions, pending payload/key, reload/stale/error and protected used evidence. `S/EvidenceResolution.test.tsx`, `S/ReceiptCorrection.test.tsx`; `backend/app/api/transactions.py`. Selected comparison/correction captures pending. |
| Select receipt / preview / accept exception | `S/OrderPaymentDetails.tsx` → `S/PaymentException.tsx`, `paymentDecisions.ts` → GET `/seller/orders/{id}/payment-preview`; POST `/{id}/decisions` | Preview blockers/versions, required reason, no model authority; acceptance is not provider verification. `S/PaymentException.test.tsx`; `backend/tests/test_payment_exceptions.py`, `test_order_decision_guards.py`. Preselection captured; selected/accepted/stale states pending. |
| Reject / cancel / replace / show decision history | `S/OrderOutcomes.tsx`, `PaymentHistory.tsx` → decisions/replacement/history endpoints in `backend/app/api/orders.py` | Explicit reasons/confirmation, predecessor/successor and allocation protection; response replaces local facts. `S/OrderOutcomes.test.tsx`, `S/PaymentHistory.test.tsx`; `backend/tests/test_order_outcomes.py`, `test_order_replacement_guards.py`. Source map only this round. |

## Delivery, assistance and administration

| Action / transition | Component → state owner → API | Response, failure and existing proof owner |
| --- | --- | --- |
| Save parcel / choose destination and pickup / review | `S/CourierWorkspace.tsx` → `CourierDraft.tsx`, `CourierReview.tsx`, `CourierReviewLocations.tsx` → GET/PATCH `/{id}/courier-draft`; GET/PUT/POST `/{id}/courier-review` | Local proposal versus reviewed current draft, parcel/connection/location/version blockers. `S/CourierDraft.test.tsx`, `S/CourierReview.test.tsx`, `S/CourierReviewLocations.test.tsx`; `backend/tests/test_courier_drafts.py`, `test_courier_review.py`. Unknown-state rendering captured with synthetic offline review. |
| Submit booking / reload current review | `S/CourierReview.tsx` → POST `/seller/orders/{id}/courier-submission`, GET review | Reservations, reviewed token, one attempt, known failure versus unknown; no casual new-key retry. `S/CourierWorkflow.test.tsx`, `S/CourierStatusPropagation.test.tsx`; `backend/tests/test_courier_submission_failures.py`, `test_courier_in_flight_changes.py`. No provider call or write made. |
| Attach booking / confirm noncreation | `S/CourierReconciliation.tsx` → POST `/seller/orders/{id}/courier-reconciliation` | Environment/reference/evidence, resolution version/key, history retained; failed lookup is not noncreation proof. `S/CourierReconciliation.test.tsx`; `backend/tests/test_courier_reconciliation.py`, `test_courier_reconciliation_replay.py`. Initial recovery UI and disabled actions captured. |
| Open/close assistant; language; workflow; reset/discard | `S/AssistantWorkspace.tsx`, `AssistantWindow.tsx` → `useAssistantConversation.ts` | Local guided interpretation, transient state, focus/panel ownership, locked discard while unresolved. `S/AssistantWorkspace.test.tsx`, `S/GuidedOrderCreation.test.tsx`, `S/GuidedPaymentOutcomes.test.tsx`. General entry UI captured; guided recovery pending. |
| Confirm guided create/record; lookup; same-key retry | `S/useGuidedOrderSubmission.ts`, `useGuidedPaymentSubmission.ts` → `useConfirmedSubmission.ts` → GET context, GET/POST key under `/seller/order-submissions` or `/transaction-submissions` | Frozen immutable payload/key, processing/unknown/reset/storage-epoch states. `S/GuidedPaymentOutcomes.test.tsx`; `backend/tests/test_order_submissions.py`, `test_transaction_submissions.py`. Manual entry is a separate seam; do not merge their proof. |
| Ask AI / selected-receipt explanation / action suggestions | `S/ReviewAssistant.tsx` → review client → POST `/seller/orders/{id}/review-assistance` | Server facts, context/receipt version and local-vs-Gemini source; advisory targets and minimized facts. `S/ReviewAssistant.test.tsx`, `S/ReviewAssistantActions.test.tsx`, `S/ReviewAssistantFacts.test.tsx`; `backend/app/api/review_assistance.py`. Button visible; panel and provider unavailable states pending. |
| Add / label / activate account | `S/PaymentAccountList.tsx`, `AddAccountForm.tsx` → `S/api.ts` → GET/POST/PATCH `/seller/payment-accounts` | Account version/validation; old order destinations stay snapshotted. `S/PaymentAccountsLocale.test.tsx`; `backend/app/api/seller.py`. Initial account list/forms rendered. |
| Courier environment / connect / replace / defaults / disconnect | `S/PathaoSettings.tsx` → requestJson → `/seller/courier/pathao/{environment}`, stores | Write-only secrets; expected version, store/service defaults, capability/status and errors; collapsed credential entry. `S/PathaoSettings.test.tsx`; `backend/tests/test_pathao_connections.py`. Disconnected production state captured; no credentials used. |
| Refresh / run evidence cleanup; completed-record cleanup | `S/EvidenceRetentionPanel.tsx`, `StructuredRetentionPanel.tsx` → `retentionApi.ts` → `/seller/retention/status`, `/cleanup`, `/structured`, `/structured/cleanup` | Separate raw/structured eligibility, explicit confirmation, failure counts and tombstones. `S/EvidenceRetentionPanel.test.tsx`, `S/StructuredRetentionPanel.test.tsx`; `backend/tests/test_structured_retention.py`. Empty eligibility captured; cleanup not sent. |

## Reachability and exclusions

`App.tsx` mounts seller work or the public buyer portal; `Root.tsx` selects the
Clerk-free versus authenticated entry. The seller section union is orders,
payments, accounts, retention. Legacy items/Gemini template modules have no
top-level entry in that shell. This is evidence of absent shell navigation,
not a complete dead-code proof or authorization to delete their backend routes.

All changed-state assertions above must ultimately be checked at their owning
server contracts. Browser fixtures cannot prove shop isolation, no-store responses,
transaction locking, real authentication, provider booking or durable concurrency.
