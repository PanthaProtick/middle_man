# 04: Find orders awaiting delivery preparation

**What to build:** Find outstanding delivery-preparation work in chat and apply the same query to the order dashboard.

**Blocked by:** 01: Unify the floating seller assistant and contextual review.

**Status:** implemented; local verification passed; browser/PostgreSQL acceptance not run

- [x] Use a shared backend-defined predicate over the full authorized shop dataset, not loaded-page filtering or simple negation of delivery_staged.
- [x] Include confirmed orders awaiting courier preparation across older backlog. Exclude booked, submitting, unknown-outcome, terminal lifecycle, and separately categorized failed-submission cases; current attempt state and booking success override historical failures.
- [x] Use Bangladesh calendar context without silently applying a created-today restriction. Support equivalent Bengali, English, Banglish, and mixed requests locally.
- [x] Return a stable paginated preview, full matching total, retrieval time, useful reason labels, and application-generated open/copy-order-reference actions.
- [x] Show in dashboard replaces conflicting search/date/status filters transparently and retrieves current data using exactly the same query; preserve the unfinished creation draft.
- [x] Cover multi-page datasets, prior-day backlog, no matches, cross-shop exclusion, current/historical booking states, dashboard parity, freshness, and loading/error behavior.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

## Implementation and handoff — 2026-11-01

Base: `041d444`; current branch: `main`; working tree contains this implementation.

- Membership is one shared predicate: authorized shop, `retained_at IS NULL`,
  `lifecycle = 'confirmed'`, and **no** `courier_attempts` row in any state.
  It is intentionally independent of `delivery_staged`: failed submissions remain
  staged but are excluded here; any success/submitting/unknown attempt also excludes,
  so current booking state overrides historical failures.
- `services/delivery_preparation.py` owns the SQL and memory implementations,
  oldest-first ordering (`coalesce(completed_at, updated_at), id`), cursor resolution
  outside the predicate, full-set total, and Dhaka reason codes. The preview route,
  `GET /api/seller/orders?work_query=preparation`, and CSV export reuse it.
- `GET /api/seller/work-queries/preparation` returns `query`, items with reason
  codes, `total`, `next_cursor`, `retrieved_at`, and `calendar_date` (Asia/Dhaka).
  No shop returns a valid empty page; missing auth is `401`; responses are no-store.
  `PRIOR_DAY_BACKLOG` is based on the order's Dhaka creation date versus retrieval
  date; there is no created-today restriction.
- The assistant broadens local Bengali/English/Banglish/mixed intent detection and
  renders a bilingual preview with total, retrieval time, stable reason labels,
  open/copy actions, paging, refresh, and show-in-dashboard. Order identities and
  actions come from the server response, never model text.
- Show in dashboard clears status/search/applied dates, resets date controls, applies
  `work_query=preparation`, reloads page 1, and displays a banner explaining the
  cleared filters. The unfinished creation draft and conversation are preserved.
- Export sends only `work_query` while active, so the CSV matches the visible set.

Changed paths: new `backend/app/{api/work_queries,models/work_query,
services/delivery_preparation}.py`, `backend/tests/test_delivery_preparation.py`;
modified `backend/app/{api/orders,main,models/order_export,services/order_export}.py`;
new frontend `usePreparationQuery.ts`, `workQueryApi.ts`, `PreparationPreview.tsx`,
`OrderWorkQueryBanner.tsx`, `deliveryPreparationCopy.ts`, and five test files;
modified assistant/order-list/export/query/workspace paths, copy audit, `types.ts`;
new `docs/contracts/delivery-preparation-query.md` plus contract/architecture indexes.

Verification: focused backend `tests/test_delivery_preparation.py` 16 passed. Focused
frontend intent/preview/assistant/hook/order-list/export/copy suites 79 passed, plus
the workspace draft-preservation test 1 passed. Root `npm run check` passed all
stages: backend tests 666 passed / 179 skipped; frontend tests 556 passed across 105
files; build and HTTP smoke passed. Evidence:
`.cache/checks/check-HubYKh/result.json` (earlier runs correctly failed on import
ordering and an unused test variable, then passed). No live Gemini/courier calls.

Remaining acceptance: real browser/mobile, hosted Clerk, and live providers were not
run. The SQL predicate is type/lint checked but the automated suite exercises the
memory path; no disposable PostgreSQL URL was available, so database execution and
concurrency between pages remain unproven. Total and membership can change between
pages on a live dataset by design. Next action: run PostgreSQL and browser acceptance
in ticket 07, then review ticket 05 attention query against the same shared-service
pattern.

## Verification follow-up — 2026-11-01

Reviewed implementation commit `c48f312` from a clean working tree. The shared
predicate, preview/dashboard/export reuse, and existing focused acceptance tests
remain intact. Found and fixed a preview freshness gap: changing or removing the
authorization token left completed results visible and allowed pending responses
from the previous token to restore obsolete results. `usePreparationQuery.ts` now
clears scoped state on a token change and invalidates pending requests before
paint. Token renewal also clears the preview; the seller can refresh it explicitly.

Added `usePreparationQuery.test.tsx`: three regression cases failed before the fix
and passed afterward, covering token replacement, token removal, completed-result
clearing, and subsequent requests using the replacement token. Focused backend:
16 passed; focused frontend: 11 passed across five files.

Final root `npm run check` passed every stage: backend 666 passed / 179 skipped;
frontend 559 passed across 106 files; lint, types, build, and HTTP smoke passed.
Evidence: `.cache/checks/check-GK2iQ5/result.json`. The first run hit a Windows
pytest system-temp permission error; the passing run used
`PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-ticket04-final`.
An intermediate run caught React lint issues in the initial fix/test harness;
both were corrected before the final gate.

Browser/mobile, PostgreSQL execution/concurrency, hosted Clerk, and live providers
remain NOT RUN. No live Gemini or courier calls were made. Next action remains
the ticket 07 browser/PostgreSQL acceptance described above.


