# Revamp baseline — package 01

Status: package 01 complete — expert baseline; external acceptance remains separate
Date: 2026-11-02 (Asia/Dhaka)
Source: `0d2f05857eea9940df13a351e80a80917f512ca6`, branch `ui/revamp`
Parent: [implementation roadmap](implementation-roadmap.md)

## Scope and method

Rendered the current `App`, seller/buyer components and production CSS in the
in-app Chromium browser. A [loopback fixture](baseline-fixture/server.mjs) supplies
synthetic reads and isolated in-memory responses for an allowlist of writes;
unexpected API reads/writes are rejected. No request reaches an application backend.
No application source, stylesheet, API, design system or business state was changed.
Existing untracked project/skill/config files were preserved.

This is an expert walkthrough, not a pilot-user study. Task time, comprehension,
success rates and improvement percentages are not measured. Static API fixtures
establish rendering and local interactions, not server correctness or persistence.
Most fixtures mount `App` directly. Completion session fixtures mount the real
`SellerSession` against a fixture-only Clerk hook double and rejection headers.
The real Clerk widget/session service is not exercised. Buyer captures use the
actual `/orders/synthetic` branch. Isolated conditional components are explicitly
named `specimen-*`; their layout is not an integrated workspace screenshot.

## Evidence bundle

The [durable evidence archive](../../docs/verification/revamp-baseline/README.md)
preserves both capture sets. Local execution outputs remain in `.cache/revamp-baseline/`:

- `manifest.json`: 76 unique captures, viewport sizes, language, headings, alerts,
  document width and page height. PNG and AX-text pairs share each capture name.
- `measurements.json`: English seller task position, control heights and form fonts.
- `action-source-index.txt`: static JSX handler/link index; navigation aid, not proof
  that every conditional control has been exercised.
- `source-hashes.json`: source/fixture hashes for reproducing this capture set.
- `server.log`, `server-error.log`: local renderer diagnostics.
- `supplement-manifest.json`: 86 unique completion captures (latest record per name),
  covering bilingual conditional controls, session recovery and stress fixtures;
  selected advice, stale decisions, history, guided retry and successful transitions.
- Total: **162 unique PNG/AX pairs**, 76 initial plus 86 completion captures.
  Supplement metrics record viewport, document width, focus and alerts.

| Captured state | Language | Widths (CSS px) |
| --- | --- | --- |
| Seller orders with three lifecycles | EN, BN | 390, 1440; EN also 320, 768, 1024 |
| Buyer terms and editable form, disconnected locations | EN, BN | 390, 1440 |
| Seller setup, signed out, empty, error, loading, no accounts | EN, BN | 390, 1440 |
| Receiving accounts / disconnected Pathao, payments / SMS, retention | EN, BN | 390, 1440 |
| General assistant, creation form, manual payment form | EN, BN | 390, 1440 |
| Order overview dialog | EN | 390, 1440 |
| Pending payment review, before selecting a receipt | EN, BN | 390, 1440 |
| Unknown courier attempt, review and recovery | EN | 390, 1440; BN recovery 390, 1440 |
| Buyer pending, confirmed, expired, read failure | EN | 390 |
| Empty creation validation; empty buyer validation | EN | 1440; 390 respectively |

No page-wide horizontal overflow was measured in these 76 captures. That does not
prove every control is visible: metric strips, tab lists and dialogs have their own
scroll behavior. Full-page PNGs do not unwrap internally scrolling dialogs;
`courier-recovery-*` captures preserve the separately scrolled recovery section.

## Observations and design hypotheses

1. **Repeat work starts far down the page.** At 390px, the workspace begins around
   y=520 and the orders heading around y=1258. At 1440px those positions are y=348
   and y=785. The masthead, three-step guide, shop summary, metrics, section nav
   and account summary all precede the order list. Test a compact repeat-use shell;
   do not delete first-run guidance without providing another discoverable home.
2. **The current sizing contradicts the design guidance.** The order search input,
   Search button, status/date controls and CSV action measure 36px high at both
   tested widths. Order search/status/date form text measures 12.8px. These miss
   the documented 44px targets and 16px form-text requirement. Fix shared ownership
   during foundations work; another final CSS override would preserve the conflict.
3. **Detail navigation needs explicit small-screen treatment.** The fourth tab is
   partly outside the visible tab strip at 390px. The dialog has a separate scroll
   surface and the assistant launcher sits near its lower edge. Test tab scrolling,
   keyboard focus, assistant overlap and recovery reachability together before
   selecting page versus dialog details.
4. **Money and claim distinctions are worth preserving.** Buyer terms separately
   show total, advance and expected COD. Payment exception review explicitly says
   seller acceptance is not independent provider verification. Simplification must
   preserve those meanings and the immutable receiving-account snapshot.
5. **Recovery is a distinct task.** The unknown courier response explains duplicate
   booking risk, disables another review/submission, and provides attach-existing
   or confirmed-noncreation paths. Only their initial rendering was inspected;
   no reconciliation mutation was sent.
6. **Local validation has a useful existing behavior.** Submitting the empty buyer
   form displays field errors and focuses `buyer_name`. The disconnected Pathao
   state leaves written-address submission available without a lookup-retry action.

These findings motivate prototypes; they do not select a new visual world,
navigation hierarchy, default queue or scroll model.

## Journey trace and completion

The [journey map](baseline-journeys.md) links responsibility groups, clients,
contracts, failure handling and existing regression owners. Test pointers are
existing evidence targets, not a claim of fresh browser or live-provider acceptance.

Completed closure evidence:

- [Control ledger and trace rules](baseline-action-trace.md): 515 control/handler
  source lines, 68 reachable component modules, response/error/test ownership for
  every supported action family; unreferenced item/Gemini screens separated.
- [Expert task and keyboard walkthroughs](baseline-walkthroughs.md): creation,
  claim submission, evidence comparison/acceptance, guided payment, correction,
  access/link recovery, delivery/unknown-booking semantics and focus ownership.
- Extended fixture cases are reproducible without credentials; known mutations
  stay in browser memory. Pagination/search are deliberately limited synthetic
  responses, not a copy of server filtering rules.
- Assertions distinguish browser-observed, source/test-only and unrun evidence.
  Pilot validation remains required when representative users are available;
  the roadmap explicitly permits expert hypotheses for baseline closure.

Actual 200% zoom, physical-device/safe-area/virtual-keyboard checks, screen readers,
OS reduced-motion and precise manual list-scroll restoration remain unverified.
Source/test owners and later acceptance risks are recorded in the walkthrough;
this package is an evidence baseline, not release or accessibility certification.

Next action: package 02 visual directions and interaction prototypes, followed by
the roadmap's design decision before broad UI implementation.

## Verification

- Fixture strict TypeScript: PASS using
  `frontend/node_modules/.bin/tsc --project .issues/project-revamp/baseline-fixture/tsconfig.json`.
- Fixture server syntax: PASS using
  `node --check .issues/project-revamp/baseline-fixture/server.mjs`.
- Browser: current modules rendered; 76 capture/measurement records; no application
  writes sent; empty buyer validation focus observed. This is synthetic UI evidence.
- Root `npm run check`: PASS with
  `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/revamp-baseline/pytest-final-20261102`;
  result `.cache/checks/check-Y4nAEJ/result.json`. Backend: 693 passed, 179 skipped;
  frontend: 110 files / 588 tests passed. Tooling, tracked-file conventions, lint,
  types, build and HTTP smoke passed. The separate fixture TypeScript check above
  covers these untracked fixture files; root conventions do not scan them.
- First root attempt `.cache/checks/check-iXCNLP/result.json`: FAIL at backend
  `tmp_path` setup (Windows shared-temp permission); 692 passed, 179 skipped,
  1 error; later stages not run. The rerun used a fresh local temp directory and
  changed no application code. New Markdown relative links were checked separately.
- Hosted Clerk, real providers, PostgreSQL concurrency, physical-device acceptance
  and pilot-user observation: NOT RUN.
- Completion fixture strict TypeScript, server/inventory syntax, archive integrity
  (162 pairs), 68 relative Markdown links and staged `git diff --check`: PASS.
- Completion root `npm run check`: PASS, `.cache/checks/check-TR7lAq/result.json`,
  with fresh local pytest base temp `pytest-completion-20261102`. All stages passed;
  conventions included 1371 tracked files after staging the baseline archive.

## Reproduce and stop

From the repository root, use installed locked frontend dependencies:

```powershell
node .issues/project-revamp/baseline-fixture/server.mjs
```

Open `http://127.0.0.1:5186/.issues/project-revamp/baseline-fixture/index.html?case=seller&lang=en`.
Use `lang=bn` for Bengali. Seller cases: `seller`, `setup`, `signedout`, `empty`,
`noaccounts`, `error`, `loading`, `courier-unknown`. Use the current navigation
and Create/Record/Inspect controls to open secondary surfaces. For unknown courier
recovery, inspect the third (confirmed) order and choose Delivery, then scroll the
dialog to the recovery section. Do not submit credentials or real customer data.

Buyer URL: `http://127.0.0.1:5186/orders/synthetic?case=buyer&lang=en`.
Other buyer cases: `buyer-pending`, `buyer-confirmed`, `buyer-expired`, `buyer-error`.
Completion cases and interaction recipes are in the evidence archive. They include
`specimen-correction`, `specimen-payment`, `specimen-evidence`, `specimen-outcomes`,
`specimen-link`, `session-expired`, `session-denied`, `session-clock`, `denied`,
`paging`, `long`, `buyer-locations`, `buyer-revoked`; `fault=unknown|stale|reset|blocked|advice-error`.
Use fresh navigation for each case; locale storage is reset by the fixture query.
Compare at 390×844 and 1440×1000; additional seller widths used 900px height.
Capture after the relevant form, shop, status or alert is visible; loading stays
pending intentionally. Stop with Ctrl+C. The task-owned hidden server was stopped
after capture; no production server or browser profile was modified.
