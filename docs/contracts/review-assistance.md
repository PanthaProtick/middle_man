# Seller review assistance

`POST /api/seller/orders/{order_id}/review-assistance` accepts `language` (`en`
or `bn`, default `en`), optional `receipt_id`, and `generate` (default `false`). Unknown fields are rejected
with 422. It never accepts a shop, prompt, findings, or allowed actions.

Seller identity establishes the owning shop. Missing/foreign orders and selected
receipts return 404; retained records return 410; orders without a pending buyer
submission return 409 `INVALID_LIFECYCLE`. Responses, including errors, are private
and no-store. A concurrent order, receipt, resolution, allocation, or related-claim
change during context construction returns 409 `REVIEW_CHANGED`; the seller must
refresh the order before requesting advice again.

The typed response contains order/version/buyer-revision/lifecycle, an opaque
`context_token`, `source: local | generated`, locale, condition, current reason codes,
`unknown_reason_present`, explanation, approved actions, narrow facts, and a typed
provider `context`. The default request is entirely local. Only `generate: true`
can request Gemini wording. There is no mutation, saved conversation, or server content cache.

## Explicit selected receipt scope

With `receipt_id`, assistance explains that receipt's authorized manual acceptance
preview rather than the automatically matched receipt. Order and receipt ownership
are checked independently before the preview is read. Empty receipt IDs are invalid.
Without a selection, the existing order-level assistance remains available.

The response adds `selected_receipt_id`, `selected_receipt_version`,
`preview_conditions` (the union of exceptions and blockers), and `preview_blockers`.
Provider mismatch, transaction-ID mismatch, and payment exceeding the order total
remain preview conditions; they never become stored automatic review reasons.
All manual preview blockers remain authoritative, including blockers caused by an
order allocation, a single other active claim, or a prior resolution.

Only the provider and transaction-ID comparison results (`same`/`different`) and
applicable order/receipt amounts are added to facts. The provider context adds
`selected_preview: {conditions, blockers}` and these minimized facts, never the
selected ID, actual TrxIDs/providers/accounts, buyer details, or full preview.
The full preview participates only in the internal freshness hash. Selected-scope
`has_matching_receipt` indicates an examined receipt, not an identity match; use
`transaction_id_comparison` and `provider_comparison` for those comparisons.

Advisory previews reuse acceptance computation through a read-only path: marker
key compatibility is checked without creating a binding, acquiring shop/order
locks, or applying expiry writes. Actual acceptance retains its existing checks.
The UI discards advice on selection, preview refresh, receipt version, order
revision, or authorization changes, ignores late responses, and verifies response
selection/version. Selection loading/errors hide scoped advice. Seller decision
drafts and existing comparison/acceptance controls retain their state. Locale
switching uses local translated scope and conditions without a provider request.

## Conditions and current reasons

`reason_codes` are the seven automatic reasons derived from current authoritative
records by the shared reconciliation rule function. They are not a copy of stored
labels. Stored codes outside the seven set `unknown_reason_present` but never add a
reason code or an invented remedy.

- `NO_RECORDED_RECEIPT`: the current claim has a provider/transaction identity but
  no matching same-shop recorded receipt. This does not prove the buyer did not pay.
- `UNKNOWN_CAUSE`: no current reason can be derived and no unknown stored code
  applies. Stale supported stored labels are not trusted.
- `UNSUPPORTED_REASON_CODE`: only unrecognized stored codes apply, or no matching
  receipt exists with an unrecognized stored code. Give generic manual-review
  guidance.
- `SENDER_MISMATCH`: the receipt sender is missing or differs from the claimed
  sender.
- `AMOUNT_MISMATCH`: the required advance, claimed amount, and receipt amount do not
  all match.
- `TIME_UNCLEAR`: the receipt time is missing, before order creation, or after claim
  submission.
- `WRONG_RECEIVING_ACCOUNT`: the receipt account differs from the order account.
- `CONFLICTING_RECEIPTS`: the same transaction identity has conflicting recorded
  observations.
- `COMPETING_CLAIMS`: more than one active claim in this shop uses the same payment,
  or an earlier review decision held this claim.
- `PAYMENT_USED`: the payment is already used or allocated.
- `MULTIPLE_REVIEW_REASONS`: more than one current reason applies.

A claim held by a prior resolution decision reports `COMPETING_CLAIMS` with
`claim_held_by_prior_resolution: true` and is excluded from `active_claim_count`.
Active claims are pending, non-held claims sharing the receipt identity in the same
shop, including the current claim when active. Related same-shop records contribute
only aggregate facts, never another buyer's identity. Foreign-shop claims never
contribute.

## Facts and provider context

`facts` is a minimal allowlist and omits fields that do not apply:

- `has_matching_receipt`
- `required_advance_minor`, `claimed_amount_minor`, `received_amount_minor`,
  `currency` for `AMOUNT_MISMATCH`
- `sender_status` (`missing` or `different`)
- `time_status` (`missing`, `before_order_creation`, `after_claim_submission`)
- `receiving_account_comparison` (`different`)
- `conflict_categories` (`amount`, `receiving_account`, `sender`, `time`; only
  categories reliably derived from conflicting observations)
- `active_claim_count`, `claim_held_by_prior_resolution`
- `payment_used`, `payment_allocated`

The response `context` is the explicit provider allowlist:

```text
condition
reason_codes
unknown_reason_present
locale
facts
permitted_actions
```

It contains no order/shop/receipt/revision/allocation ids, names, phone numbers,
addresses, raw SMS, notes, product descriptions, credentials, timestamps, or
unrelated history. `context_token` is opaque and may hash internal ids and facts.

## Actions and advisory boundary

`CHECK_TRANSACTIONS` opens Received Payments. `CORRECT_BUYER_DETAILS` opens the
existing buyer correction tab. The application maps these identifiers to its own
controls; response targets never become arbitrary URLs. No action approves,
resolves, edits, or books anything automatically. Existing review labels and hard
blockers remain unchanged.

Sender, amount, time, and wrong-account reasons offer both controls. Conflicting
receipts, competing claims, and used payments offer Received Payments only. Missing
receipts and unrecognized stored codes offer both. Unknown cause offers Received
Payments only. Combined reasons offer the ordered union; an unrecognized stored code
adds both existing controls. No approval or arbitrary link is ever offered.

## Freshness and presentation

The context token binds order/version/lifecycle, active revision identity and claim
fields, stored labels, matching receipt identity/version/state and observations,
resolution history, allocation and used-marker state, sorted related claims,
selected receipt identity/version, and the derived condition/reasons/facts. It
excludes locale. Related receipt, resolution, allocation, or competing-claim changes
therefore replace advice and require another explicit action click. Stale order
responses are discarded.

Repeating this local POST is provider-free revalidation. The current view reuses its
result only after authorization and context revalidation on reopening, window
focus/visibility return, and before following a suggested action. Locale changes
translate local guidance and fact labels without a request; server explanation is
used only while its locale matches the active locale. No assistant content enters
browser storage. Revalidation never dispatches a provider call.

## Optional Gemini wording

For private synthetic reviews only, manually set `REVIEW_GEMINI_ENABLED=true` and
configure `GEMINI_API_KEY`; `GEMINI_MODEL` selects one Gemini model. Credentials
alone do not enable generation. Set the flag to `false` to disable it again.
`SELF_TEST_MODE=true` overrides enablement and prevents live AI calls. Public demos
remain local and address extraction remains retired, regardless of these settings.
No live provider verification is part of automated testing.

The panel first loads local guidance. Its separate Generate with Gemini control
sends the explicit request. Generated wording is plain text; approved navigation,
facts, and blockers always remain backend-owned. Output must be a bounded typed
object with `explanation` and a subset of permitted `action_ids`; invalid objects,
links, or excess output fall back to deterministic guidance.

Atomic reservations permit five attempts per Asia/Dhaka day application-wide,
one attempt per 60 seconds, five per unchanged context across days, and a shop
daily limit configured with `REVIEW_GEMINI_SHOP_DAILY_LIMIT` (1–5, default 5).
Failures count. Busy, disabled, unconfigured, limited, and local revalidation
requests do not dispatch or consume attempts. One review has one in-flight call.
The provider has a 12-second transport timeout and a 15-second overall deadline;
wire responses are bounded at 16 KiB, generated JSON at 8 KiB, and explanations at
2000 characters. No automatic retries, redirects, alternate model, or provider fallback.

`fallback_status` distinguishes `disabled`, `unconfigured`, `busy`, `limited`,
`timeout`, `rejected`, `malformed`, and `unavailable`; the panel supplies Bengali
and English status text alongside useful local guidance. Only current-view output
with matching authorization, context, and locale is reused. Locale changes never
generate automatically. Generation completion rechecks shop ownership and the
entire context; stale results are discarded without regeneration.

Counters are content-free hashes in one process and reset on restart. Daily shop
metadata has at most five entries; unchanged-context counters retain at most 1024
entries per process lifetime, rejecting new contexts at capacity rather than
evicting exhausted counters. These are application controls, not Google's remaining
quota. Free-provider availability and production readiness are not guaranteed.
No durable counters, prompts, outputs, conversation history, or provider-body logs
are added. Automated tests block external networking and intercept the provider.
