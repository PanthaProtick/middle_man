# 03: Remove proven obsolete scaffolding

**Status:** ready-for-agent

**What to build:** A repository free of demonstrably unused template scaffolding, with supported entry points and meaningful coverage intact.

**Blocked by:** 01 — Establish cleanup inventory and convention baseline.

- [x] Trace inventory candidates through imports, dynamic usage, registered routes, UI navigation, commands, documentation, contracts, and tests before removing them.
- [x] Remove only proven dead code and obsolete support artifacts; reachable example features remain unless separately retired by the owner.
- [x] Remove tests only for retired behavior or demonstrably equivalent meaningful retained coverage; identify retained success, failure, boundary, security, and concurrency cases.
- [x] Preserve operational tools and migrations whose future or explicit-command use is not represented by ordinary imports.
- [x] Repair active exports, commands, links, and contracts affected by a removal. Retain and document unresolved candidates rather than guessing.
- [x] Preserve offline standby behavior and existing provider/authentication boundaries.
- [x] Verify supported entry points and affected test collection; run focused checks for each bounded removal group and final root `npm run check`.
- [x] Record removals, supporting evidence, retained uncertainties, and actual verification results.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Keep reachable demo scaffolding: `frontend/src/features/{demo,gemini,items}`
  render through `App.tsx`'s "Demo & tools" tab; backend chat/item routes,
  `services/gemini.py`, and `models/schemas.py` remain reachable through that UI
  and HTTP smoke. Do not retire them as cleanup.
- Keep operational and historical assets: `scripts/cleanup-phase1-orders.py`,
  `obsolete_cleanup.py`, `raw_evidence_cli.py`, all migrations, PostgreSQL suites,
  session-analysis evidence, `tasks/`, `design-system/`, and `.agents/`.
- Investigate only with evidence: unused-looking assets
  (`frontend/src/assets/*`, `frontend/public/icons.svg`), exported symbols with no
  caller, and stale architecture/contract statements. Reference tracing must cover
  build assets, runtime navigation, docs, and tests.
- A "no removal" outcome with recorded evidence is acceptable; do not manufacture
  deletions or fold feature organization into this ticket.

**Required checks:** `rg` import/runtime references, frontend build, affected
backend/frontend tests, and final root `npm run check`. Record any unrun gate.

## Execution record (2026-10-29)

Base: `main` at the ticket-02 handoff, clean checkout. Method: repository-wide
`git grep`, a module graph from `frontend/src/main.tsx` through relative imports,
CSS selector-to-markup scan, and Python module/symbol reference scan across
`backend/app`, `backend/tests`, `scripts`, and `docs`. No file was removed from
age or appearance alone.

### Removed (all zero references in code, tests, config, docs, and navigation)

- **Vite/template assets:** `frontend/src/assets/{hero.png,react.svg,vite.svg}`,
  `frontend/public/icons.svg`, `frontend/public/favicon.svg`. `index.html` uses an
  inline data-URI icon, not `favicon.svg`; no markup, CSS `url()`, test, or doc
  referenced the others.
- **Orphan code:** empty `frontend/src/App.css` (never imported);
  `frontend/src/components/TechStackBar.tsx` (initial-commit template, zero
  references); `frontend/src/features/seller/FormErrorBanner.tsx` (zero references
  after `b9f5c37` stopped importing it and put the same `role="alert"` behavior in
  `CreateOrderModal.tsx` and `ParcelEarlyFields.tsx`; the orphan file itself was
  last edited by `4f1ae01`); unused type alias `ExportCopy` in
  `frontend/src/features/locale/exportCopy.ts` (zero references anywhere).
- **Dead CSS:** `.hero`, `.hero-pill`, `.gradient-text`, `.tech-strip`,
  `.tech-chip`, `.team-grid`/`.member-*`/`.avatar`, `.buyer-section-title`,
  `.buyer-help`, `.buyer-order-summary`, `.form-grid-3`, and the matching
  responsive/theme rules. Each selector was confirmed absent from all TSX/HTML.
- No backend source, route, script, migration, or test was removed. Backend
  module and symbol scans found every module referenced; zero-reference symbols
  were FastAPI decorator-registered handlers or live internal helpers.

### Retained with evidence

- Reachable demos and their backend counterparts: `features/{demo,gemini,items}`,
  `App.tsx` "Demo & tools" navigation, chat/item routes, `services/gemini.py`,
  and `models/schemas.py`.
- Operational/history assets named in the inventory: cleanup scripts, all
  migrations, PostgreSQL suites, `tasks/`, `design-system/`, `.agents/`.
- Internal-only exported types/functions: 274 exported names were scanned across
  non-test frontend sources; 26 had no cross-file reference. One (`ExportCopy`)
  had no reference at all and was removed. The other 25 (for example
  `AddressInput`, `PaymentClaimInput`, `RootProps`, `OrderDateControlsProps`,
  `SmsImportState`, `ExportFailureCode`, `readStoredLocale`) are live symbols used
  inside their defining modules; un-exporting them is API-surface churn, not this
  ticket. The `WorkspaceSection` barrel re-export has no external consumer but the
  type is live internally, so the barrel stays consistent with its neighbours.
- `buyerLocaleFixtures.ts`, `courierPostSubmissionTestData.ts`, `src/test/setup.ts`,
  and `vite-env.d.ts`: test/ambient support, unreachable from the runtime graph
  by design.
- Clerk `.cl-rootBox`/`.cl-cardBox` selectors in `sellerSignIn.css`: external
  runtime class names not present in JSX; kept to preserve the auth boundary.
- Stale "Dev Template" naming in `README.md`/`main.py` and the outdated module map
  in `docs/ARCHITECTURE.md` remain ticket 09 documentation work, not removal.
- `.scratch/pathao-courier/issues/02-capture-parcel-details-early.md` still names
  `FormErrorBanner` as the alert implementation. It is a completed historical work
  record, retained as history per the documentation convention; the current
  behavior is documented above and in the execution evidence.
- Existing duplicate style layers such as `.buyer-order-item` (four definitions)
  were not reorganized; that is feature/style ownership work for tickets 04-05,
  not a deletion candidate.
- Removing `frontend/public/` leaves Vite's default `publicDir` absent. Build and
  HTTP smoke pass; external static-hosting assumptions cannot be verified from
  this repository.

### Tests

No test files or assertions were removed. The behavior previously exercised
through `FormErrorBanner` remains covered by `CreateOrderModal.test.tsx` and
`CreateOrderParcelValidation.test.tsx` (`role="alert"`, invalid fields, focus,
correction, preserved entries, successful retry). All retained suites still cover
success/failure paths, boundaries, authorization/public-link security,
idempotency/replay, and PostgreSQL contention where the database gate is set.

### Verification (actual)

- Group A (template assets): production build passed with the assets absent (2075
  modules); HTTP smoke later served the built page, JS, and CSS. No markup, CSS
  `url()`, doc, or test referenced them.
- Group B (orphan code/dead CSS): focused Vitest run
  (`CreateOrderModal.test.tsx`, `CreateOrderParcelValidation.test.tsx`,
  `App.test.tsx`) passed 3 files / 10 tests, covering the retained alert behavior
  and app entry/navigation; `npm run lint:frontend` passed.
- Full frontend suite: 78 files / 439 tests passed. `npm run build` passed (2075
  modules).
- Final `npm run check` after the last source edit: PASS at
  `.cache/checks/check-Z718ef/result.json`; tooling, backend lint/types/tests
  (**493 passed, 175 skipped**), frontend lint/test/build, and HTTP smoke all
  passed. Post-removal `git grep` found no active reference to removed paths or
  selectors.
- Not run / not claimed: PostgreSQL suites requiring `BUYER_TEST_POSTGRES_URL`
  (reported skipped), real browser interaction, hosted Clerk sessions, live
  Gemini, and Pathao sandbox/live booking. No remaining markup consumes the
  removed selectors, but browser rendering was not exercised.

Next action: ticket 04 may start feature organization. No follow-up is required
for this ticket beyond the ticket 09 documentation reconciliation.

