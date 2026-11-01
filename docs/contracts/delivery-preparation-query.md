# Delivery-preparation work query

## Shared membership rule

`work_query=preparation` selects confirmed orders for the authorized shop that
have never had a courier submission attempt:

```text
OrderTable.shop_id == authorized shop
AND OrderTable.retained_at IS NULL
AND OrderTable.lifecycle == 'confirmed'
AND NOT EXISTS (any courier_attempts row for the order)
```

It is deliberately not `delivery_staged` and not its negation. A failed
submission remains staged but belongs to the separately categorized
failed-submission case, so it does not re-enter preparation. Any attempt in
`submitting`, `success`, `failed`, or `unknown` excludes the order, including a
success that follows an older failure and a failure that follows a success.
Terminal and pre-confirmation lifecycles (`pending`, `awaiting_buyer`,
`cancelled`, `rejected`, `expired`) and retained orders are excluded.

The same predicate is used by the preview route, the order dashboard list, and
CSV export. There is no created-today restriction and older backlog is included.

## Preview endpoint

`GET /api/seller/work-queries/preparation?cursor=&limit=10`

- `limit` is 1–50; the default is 10.
- Items are ordered oldest outstanding first using
  `coalesce(completed_at, updated_at) ASC, id ASC`. `completed_at` records the
  confirmation time, so later edits do not reorder the backlog.
- `cursor` is the last order ID from the previous response. It is resolved
  outside the predicate so a cursor order that leaves the match set between
  pages still continues from the correct position.
- The response contains `query`, `items`, `total`, `next_cursor`,
  `retrieved_at`, `calendar_date`, and `timezone=Asia/Dhaka`. `total` counts the
  whole authorized match set, not the page, and may change while browsing a live
  dataset.
- Each item carries stable reason codes localized by the client:
  `AWAITING_COURIER_PREPARATION` is always present, and `PRIOR_DAY_BACKLOG` is
  added when the order's creation date is before the retrieval date in the
  Bangladesh calendar.
- All returned identities and actions are server-generated. The assistant never
  derives order IDs, references, or mutations from model text.
- Responses are `Cache-Control: no-store, private` and
  `Referrer-Policy: no-referrer`. A seller without a shop receives a valid empty
  page; missing authentication is `401`.

## Dashboard and export parity

`GET /api/seller/orders?work_query=preparation` and
`GET /api/seller/orders/export?work_query=preparation` reuse the same predicate and
exclusions. A work query is exclusive: `status`, `search`, `from_date`, and
`to_date` are ignored when it is present, because the dashboard clears those
conflicting controls and shows a visible banner. Export keeps the existing
500-row bound and `EXPORT_TOO_LARGE` behavior for the selected set; the preview
and dashboard additionally share oldest-first ordering and the cursor contract.

## Validation evidence

Automated backend coverage runs against the in-memory store with synthetic
providers and makes no live Gemini or courier calls. It covers every attempt
state and history, prior-day backlog, multi-page cursor stability, no matches,
cross-shop and retained exclusion, dashboard parity, and export parity.
PostgreSQL-specific execution is optional and skipped without a disposable
`BUYER_TEST_POSTGRES_URL`.
