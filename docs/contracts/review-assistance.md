# Local seller review assistance

`POST /api/seller/orders/{order_id}/review-assistance` accepts `language` (`en`
or `bn`, default `en`) and optional `receipt_id`. Unknown fields are rejected
with 422. It never accepts a shop, prompt, findings, or allowed actions.

Seller identity establishes the owning shop. Missing/foreign orders and selected
receipts return 404; retained records return 410; orders without a pending buyer
submission return 409 `INVALID_LIFECYCLE`. Responses, including errors, are private
and no-store. A concurrent order change during context construction returns 409
`REVIEW_CHANGED`; the seller must refresh the order before requesting advice again.

The typed response contains order/version/buyer-revision/lifecycle, an opaque
`context_token`, `source: local`, locale, condition, stored reason codes, explanation,
approved actions, and narrow facts (`has_matching_receipt`). There is no external
AI request, mutation, saved conversation, or server content cache.

- `NO_RECORDED_RECEIPT`: the current claim has a provider/transaction identity but
  no matching same-shop recorded receipt. This does not prove the buyer did not pay.
- `UNKNOWN_CAUSE`: a receipt exists without stored reasons, or the current claim
  cannot establish a missing-receipt finding. No cause is invented.
- `UNSUPPORTED_REASON_CODE`: stored reasons are present. Until later reason slices,
  give generic manual-review guidance, including for unfamiliar codes.

`CHECK_TRANSACTIONS` opens Received Payments. `CORRECT_BUYER_DETAILS` opens the
existing buyer correction tab. The application maps these identifiers to its own
controls; response targets never become arbitrary URLs. No action approves,
resolves, edits, or books anything automatically. Existing review labels remain.

The context token binds order/revision/lifecycle, current claim identity, stored
reasons, matching receipt presence/version, and selected receipt identity/version.
It excludes locale. Selected receipts are ownership/retention checked and bound to
freshness, but do not change the explanation in this slice; selected-preview
explanations belong to ticket 06.

Repeating this local POST is provider-free revalidation. The current view reuses
its result only after authorization and context revalidation on reopening, window
focus/visibility return, and before following a suggested action. Changed context
replaces advice and requires another action click. Stale order responses are
discarded. Order/shop/session/version/revision/reason/receipt/lifecycle changes
destroy the view and discard late requests. Locale changes translate local guidance
without a request. No assistant content enters browser storage. Later generation
must preserve this local revalidation path without dispatching a provider call.
