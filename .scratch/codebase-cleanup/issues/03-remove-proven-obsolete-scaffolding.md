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

