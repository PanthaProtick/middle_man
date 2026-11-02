# Package 12: Request/State Seams, Performance, and Repository Cleanup

## 1. Context & Scope
Package 12 focused on request generation, pagination merges, refresh bursts, session transitions, temporary data lifetimes, bundle size optimization, and dead code cleanup across the repository.

### Key Goals & Achievements
- **Request Generation & Refresh Bursts**:
  - Cleaned up session state lifetimes on token changes in `useTodayMetrics`.
  - Added visibility-based pause for `/api/health` polling in `AppShell` to avoid background polling bursts when tabs are inactive.
- **Pagination Merges & State Seams**:
  - In `useSellerOrders.ts`, deduplicated merged orders on `loadMore` (prevented duplicate IDs shifting into view), accurately toggled loading state on cursor queries, and cleanly reset state on auth token change or logout.
  - In `useTransactionInbox.ts`, deduplicated transactions on pagination merges and reset state on auth token change or logout.
- **Bundle Optimization**:
  - Configured manual chunking in `frontend/vite.config.ts` (`clerk`, `icons`) to split the 872 kB monolithic bundle into manageable chunks under 500 kB (`index.js`: 491 kB, `clerk.js`: 367 kB, `icons.js`: 14 kB, built in 782ms) without any chunk size warnings.
- **Dead Code & CSS Pruning**:
  - Removed dead starter template CSS `frontend/src/styles/demo.css` and its `@import` in `frontend/src/index.css`.
  - Removed obsolete CSS selectors in `frontend/src/styles/theme.css` (`.chat-container`, `.idea-box`, `.tab-btn`, etc.) while adding `.spin` and `@keyframes spin` to maintain animation integrity.
  - Removed unreachable template remnants (`frontend/src/features/gemini/` and `frontend/src/features/items/`) that were outside the live application shell.
- **Contract Integrity**:
  - Preserved `/api/items` backend routes and contract tests per `AGENTS.md` invariants.

## 2. File Mod Checklist
- [x] `frontend/src/features/seller/useTodayMetrics.ts`
- [x] `frontend/src/features/seller/useSellerOrders.ts`
- [x] `frontend/src/features/seller/useTransactionInbox.ts`
- [x] `frontend/src/features/seller/usePaginationSeams.test.tsx` (new regression test)
- [x] `frontend/src/App.tsx`
- [x] `frontend/vite.config.ts`
- [x] `frontend/src/index.css`
- [x] `frontend/src/styles/theme.css`
- [x] Remove `frontend/src/styles/demo.css`
- [x] Remove `frontend/src/features/gemini/GeminiPlayground.tsx` & `index.ts`
- [x] Remove `frontend/src/features/items/DataExplorer.tsx` & `index.ts`
- [x] Update `.issues/project-revamp/implementation-roadmap.md`

## 3. Verification Targets
- `npm run conventions`: Passed (1555 tracked files; 33 at the 250-line review trigger).
- `npm run test:backend`: Passed (693 passed, 179 skipped in 31s).
- `npm run test:frontend`: Passed (118 test files, 625 passed).
- `npm run typecheck`: Passed.
- `npm run build`: Passed (all chunks under 500 kB, 0 warnings).
- `npm run check`: Final pre-commit gate.
