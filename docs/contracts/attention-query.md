# Attention work query

## Shared membership and priority

`work_query=attention` selects orders for the authorized shop that need seller
action. `OrderTable.retained_at IS NULL` is required, and each order appears at
most once, in the highest-priority applicable category:

| Rank | Category | Membership | Outstanding timestamp |
| --- | --- | --- | --- |
| 0 | `unknown_outcome` | lifecycle `pending`/`confirmed`, latest attempt `unknown` | latest attempt `updated_at`, then `created_at` |
| 1 | `failed_submission` | lifecycle `pending`/`confirmed`, latest attempt `failed` | latest attempt `updated_at`, then `created_at` |
| 2 | `pending_review` | lifecycle `pending`, no attempt at all | `first_submitted_at`, then `created_at` |
| 3 | `preparation` | lifecycle `confirmed`, no attempt at all | `coalesce(completed_at, updated_at)` |
| 4 | `awaiting_buyer` | lifecycle `awaiting_buyer`, no attempt at all | `created_at` |

Latest means the highest `attempt_number` (database order
`attempt_number DESC, id DESC`). The in-memory store mirrors
`get_latest_attempt` by using the last recorded attempt. Historical attempts never
admit an order on their own, so a current `success` or `submitting` attempt
supersedes an older failure or unknown outcome and removes the order. Terminal
lifecycles (`cancelled`, `rejected`, `expired`), other shops, and
retained orders are excluded.

`pending_review` includes every pending submission regardless of stored
`review_reasons`, including empty or unknown codes ("uncoded reviews"). A pending
order whose current attempt is `failed` or `unknown` belongs to that attempt
category instead. The preview deliberately does not re-emit stored review reason
codes; clients receive only the category reason code plus `PRIOR_DAY_BACKLOG`.

## Ordering and cursor

Items sort by category rank ascending, then outstanding timestamp ascending, then
`order.id` ascending as the stable tie-breaker. Oldest outstanding work appears
first within each category.

`cursor` is an opaque `rank:microseconds-since-epoch:order_id` key describing the
last returned item. Because the key carries its own facts, paging remains stable
when the cursor order later leaves the match set or changes category. A bare order
ID is also accepted for compatibility when its current facts resolve; an unknown
or invalid cursor restarts at page one. `next_cursor` is `null` on the last page.
Out-of-range cursor timestamps are invalid and also restart at page one.
Pages read live facts rather than a fixed snapshot: an order whose priority or
outstanding timestamp changes can reappear on a later page. The assistant merges
pages by order ID, replacing repeated facts while preserving first-seen positions.
Refresh retrieves the current priority ordering and removes resolved work.

## Preview endpoint

`GET /api/seller/work-queries/attention?cursor=&limit=10`

- `limit` is 1–50; the default is 10. `cursor` is bounded to 128 characters.
- The response contains `query=attention`, `items`, `total`, `next_cursor`,
  `retrieved_at`, `calendar_date`, and `timezone=Asia/Dhaka`. `total` counts the
  whole authorized match set, not the page, and may change while browsing a live
  dataset.
- Each item carries `order`, `category`, and `reason_codes` (`UNKNOWN_OUTCOME`,
  `FAILED_SUBMISSION`, `PENDING_REVIEW`, `AWAITING_COURIER_PREPARATION`, or
  `AWAITING_BUYER_SUBMISSION`, plus
  `PRIOR_DAY_BACKLOG` when the order's creation date is before the retrieval date
  in the Bangladesh calendar). There is no created-today restriction.
- All returned identities and actions are server-generated. The assistant never
  derives order IDs, references, or mutations from model text.
- Responses are `Cache-Control: no-store, private` and
  `Referrer-Policy: no-referrer`. A seller without a shop receives a valid empty
  page; missing authentication is `401`.

## Dashboard and export parity

`GET /api/seller/orders?work_query=attention` and
`GET /api/seller/orders/export?work_query=attention` reuse the same membership and
priority predicate. A work query is exclusive: `status`, `search`, `from_date`,
and `to_date` are ignored when it is present, because the dashboard clears those
conflicting controls and shows a visible attention banner. Export keeps the
existing 500-row bound and `EXPORT_TOO_LARGE` behavior.

## Validation evidence

Automated backend coverage runs against the in-memory store with synthetic
providers and makes no live Gemini or courier calls. It covers coded and uncoded
pending reviews, current versus historical attempts, overlapping categories,
priority and tie-breaker ordering, multi-page cursor stability after a cursor
order leaves or changes category, midnight/prior-day backlog, terminal, retained,
cross-shop, no-shop, and unauthenticated cases, plus dashboard and export parity.
PostgreSQL-specific execution is optional and skipped without a disposable
`BUYER_TEST_POSTGRES_URL`.
