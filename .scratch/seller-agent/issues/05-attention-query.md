# 05: Find and prioritize orders needing attention

**What to build:** Show actionable outstanding order work with consistent reasons, priority, counts, and dashboard navigation.

**Blocked by:** 04: Find orders awaiting delivery preparation (shared work-query and dashboard-filter behavior).

**Status:** implemented

- [x] Include pending buyer submissions including uncoded reviews, awaiting preparation, current failed courier submissions, and unknown-outcome bookings.
- [x] Exclude awaiting-buyer, completed bookings, cancelled/rejected/expired orders. Active submissions display progress rather than an immediate-action item; successful/current attempt state supersedes historical failures.
- [x] Deduplicate orders and show applicable reasons; prioritize unknown bookings, failed submissions, pending reviews, then preparation, with oldest outstanding work first and stable pagination.
- [x] Compute category priority and ordering from authoritative lifecycle/attempt facts; document the chosen outstanding timestamps and tie-breaker and keep dashboard/chat semantics identical.
- [x] Include older unresolved backlog under Bangladesh-today context; provide totals, retrieval time, paginated results, open/copy-reference actions, and clearly labelled replacement dashboard filters.
- [x] Support bilingual/mixed workflow requests without external-model dependency and preserve pending creation drafts during searches.
- [x] Test overlapping categories, uncoded reviews, historical/current attempts, pagination and ordering, midnight/backlog cases, no results, ownership, query parity, and stale results.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

### Implementation

- Backend: shared attention predicate and priority ordering in
  `backend/app/services/attention.py`, cursor/key helpers in
  `attention_cursor.py`, in-memory parity in `attention_memory.py`; category,
  reason, and preview models in `models/work_query.py`; preview route in
  `api/work_queries.py`; dashboard membership in `api/orders.py`; export
  membership in `models/order_export.py` and `services/order_export.py`.
- Frontend: `useAttentionQuery.ts`, `AttentionPreview.tsx`,
  `locale/attentionCopy.ts`; assistant workflow wiring in
  `useAssistantConversation.ts`, `GuidedAssistant.tsx`, and
  `assistantConversation.ts`; dashboard work-query union in `useSellerOrders.ts`,
  `OrderWorkQueryBanner.tsx`, `OrderList.tsx`, `OrderExport.tsx`, `api.ts`, and
  `SellerWorkspace.tsx`.
- Contract: `docs/contracts/attention-query.md`, linked from
  `docs/API_CONTRACTS.md`; `docs/ARCHITECTURE.md` router row updated.

### Verification (actual)

- `npm run test:backend -- tests/test_attention_query.py tests/test_attention_query_parity.py`: 12 passed.
- Focused frontend suites for attention hook, preview, assistant integration,
  intent parsing, work-query application, dashboard banner, export parameter,
  and copy audit: 101 passed; assistant regression suites: 9 passed.
- `npm run typecheck`: backend and frontend pass.
- Root `npm run check`: PASS tooling, conventions, backend lint/types/tests,
  frontend lint/tests/build, HTTP smoke; result
  `.cache/checks/check-5rQLoX/result.json`.

### Unrun gates and risks

- PostgreSQL execution of the correlated latest-attempt SQL is not proven in this
  environment; automated evidence uses the in-memory store.
- Browser acceptance and live courier/Gemini providers were not exercised.
- The preview sets `total` at retrieval time; it can change while a seller pages
  through a live dataset, as documented in the contract.

### Next action

- Optional: run the same contract against a disposable `BUYER_TEST_POSTGRES_URL`
  and perform browser acceptance of the assistant preview and dashboard banner.

### Verification follow-up (2026-11-01)

- Reproduced and fixed out-of-range cursor timestamps raising server exceptions;
  invalid timestamps now follow the documented page-one fallback. Regression
  coverage exercises both attention preview and dashboard endpoints.
- Reproduced and fixed duplicate assistant cards when an order changes priority
  between live pages. Merge by order ID uses the latest returned facts; refresh
  restores current ordering and removes resolved work. A fixed dataset snapshot
  remains outside this query's contract.
- Focused backend attention suites: 14 passed. Focused frontend hook, preview,
  assistant, intent, and dashboard-work-query suites: 33 passed.
- Root `npm run check`: PASS all stages; result
  `.cache/checks/check-PrFqmZ/result.json`. Set `PYTEST_ADDOPTS` to
  `--basetemp=E:/middle_man/.cache/pytest-attention-verify` for this run after the
  first run hit a Windows system-temp permission error (679 passed, 179 skipped,
  one fixture setup error; `.cache/checks/check-l8FaNw/result.json`).
- PostgreSQL, browser acceptance, and live providers remain unrun; the existing
  next action above still applies.

### CI timestamp fixture follow-up (2026-11-01)

- GitHub run `41296866896` failed only the Ubuntu timestamp/ID ordering test.
  Its supposed ties used separate wall-clock reads, allowing distinct instants.
- `backend/tests/test_attention_query.py` now assigns one shared completion
  timestamp to tied orders. Production ordering and existing assertions remain.
- Focused attention suites: 14 passed. Root `npm run check`: PASS all stages,
  `.cache/checks/check-sWlImH/result.json`, with `PYTEST_ADDOPTS` set to
  `--basetemp=E:/middle_man/.cache/pytest-ci-timestamp`. Initial gate hit the
  Windows system-temp permission error (692 passed, 179 skipped, one setup
  error; `.cache/checks/check-4EkDgu/result.json`).
- Next action: push the fix and verify the Ubuntu Actions job; remote rerun
  remains unrun. PostgreSQL and live-provider acceptance remain outside this fix.
