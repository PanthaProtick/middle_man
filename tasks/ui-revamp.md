# UI revamp — 2026-10-24

Status: implemented locally; no deployment or commit requested.

## Objective and decisions

Research likely users and revamp the complete existing React interface using ui-ux-pro-max. Audience and source links: [design rationale](../docs/ui-audience-and-design.md). Chosen direction: light everyday shop desk, deep teal actions, readable English/Bangla buyer flow and a single seller navigation set. Marketplace recommendations from the skill were rejected because this product starts after an order is agreed in chat.

## Scope and checkout preservation

The checkout already contained App/Header/workspace/index.css changes, extracted seller sections and demo components, plus package.json, scripts/workspace.mjs and .githooks changes. Built on existing UI extractions; left unrelated tooling changes intact. No backend domain or endpoint contracts changed.

Changed surfaces: App shell, header, seller sections/navigation/setup, order/payment/account/retention screens and dialogs, buyer details/submission/status/evidence, demo tools. Replaced dark-only text/panel colors with semantic tokens. Split index.css into styles/foundation.css, navigation.css, workspace.css, buyer.css, demo.css and theme.css. Added App.test.tsx and updated metric assertions with explicit label/count pairings.

Avoid unsupported secure/official-account implications. Page-derived metrics now say Loaded Orders/Payments. Demo tools are secondary and return to the shop. Buyer routes no longer poll seller health. Added setup/filter label associations, skip navigation, navigation current-state semantics, visible focus, touch-sized actions and reduced-motion support.

## Exact verification

- Focused seller/buyer portal suites: 14 tests passed.
- App shell regression tests: 2 passed.
- Metrics regression: 1 passed, preserving counts and asserting each label/value pair.
- First root check exposed the old Total Orders assertion; updated it for accurate pagination wording and strengthened the count assertions.
- Final `npm run check`: PASS all eight stages. Result: `.cache/checks/check-fB112m/result.json`. Frontend: 25 files, 109 tests passed. Backend: 229 passed, 64 skipped. Lint, types, production build and HTTP smoke passed.
- `git diff --check`: PASS (line-ending notices only).
- `node .scratch/ui-revamp-browser.cjs`: PASS using installed Edge via Playwright with synthetic intercepted API responses; no page errors. Seller and buyer at 375/768/1024/1440px; mobile order dialog, payments, accounts, demo round-trip, setup, seller error, buyer pending/confirmed/expired/error. No horizontal overflow in all 18 captures.
- Browser evidence: `.cache/ui-revamp/browser-results.json` and adjacent PNGs. Visually inspected desktop seller, mobile buyer, mobile create-order dialog, mobile confirmed state and mobile demo.
- Preview server started by this task: http://localhost:5175 (earlier ports occupied). Codex browser open request queued.

## Limits and next action

Desk research supports audience hypotheses, not measured UX improvements. No live-provider, hosted database, authentication or deployment acceptance claimed. Backend tests skipped their environment-dependent cases. Existing offline/manual paths retained. Light is the supported theme; full seller localization and real-device pilot usability remain future research. Next action: review the running UI and test tasks with pilot sellers/buyers before measuring completion or conversion gains.

## Post-cleanup note (2026-10-28)

Cleanup ticket 02 removed the disposable browser probe and its TSX previews. The
command above is historical and is no longer runnable. No maintained Playwright
suite exists, so the visual/layout coverage is historical only; the written
results and local `.cache/ui-revamp/` evidence remain the record.
