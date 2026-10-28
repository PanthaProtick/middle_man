# 03: Remove proven obsolete scaffolding

**Status:** ready-for-agent

**What to build:** A repository free of demonstrably unused template scaffolding, with supported entry points and meaningful coverage intact.

**Blocked by:** 01 — Establish cleanup inventory and convention baseline.

- [ ] Trace inventory candidates through imports, dynamic usage, registered routes, UI navigation, commands, documentation, contracts, and tests before removing them.
- [ ] Remove only proven dead code and obsolete support artifacts; reachable example features remain unless separately retired by the owner.
- [ ] Remove tests only for retired behavior or demonstrably equivalent meaningful retained coverage; identify retained success, failure, boundary, security, and concurrency cases.
- [ ] Preserve operational tools and migrations whose future or explicit-command use is not represented by ordinary imports.
- [ ] Repair active exports, commands, links, and contracts affected by a removal. Retain and document unresolved candidates rather than guessing.
- [ ] Preserve offline standby behavior and existing provider/authentication boundaries.
- [ ] Verify supported entry points and affected test collection; run focused checks for each bounded removal group and final root `npm run check`.
- [ ] Record removals, supporting evidence, retained uncertainties, and actual verification results.

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

