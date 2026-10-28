# 02: Clean scratch storage and fix artifact producers

**Status:** ready-for-agent

**What to build:** Scratch storage containing only past/current work records, with useful executable checks and evidence discoverable in maintained locations and routine runs no longer recreating clutter.

**Blocked by:** 01 — Establish cleanup inventory and convention baseline.

- [ ] Follow the approved inventory dispositions, recording evidence for each removal and destination for each retained artifact.
- [ ] Preserve specs, issues, completed tickets, indexes, Markdown acceptance notes, and contract annexes together; do not erase implementation history.
- [ ] Move reusable checks into existing owned test locations, operational tools into maintained scripts, and useful historical development evidence into documentation verification storage.
- [ ] Retain uncertain candidates in appropriate non-scratch locations with their investigation notes. Inspect evidence sensitivity before tracking it elsewhere; do not expose private data.
- [ ] Remove proven disposable output; direct future temporary logs, reports, previews, and run data into ignored cache storage. Update producers, commands, imports, and active links together.
- [ ] Preserve unique probe coverage through maintained tests where practical, including discovery and fixture behavior. Historical results remain historical, with truthful context after relocation.
- [ ] Do not execute operational purges, remote mutations, or provider actions to prove a script move. Use safe existing test/dry-run boundaries and report limitations.
- [ ] Verify scratch contents and affected links, test discovery, and safe producer output paths. Run focused backend/frontend/tooling checks as relevant, then final root `npm run check`.
- [ ] Record final dispositions, results, exceptions, and remaining uncertainty for downstream tickets.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Keep all 101 Markdown work records in place, including
  `pathao-courier/ticket12-compaction-handoff.md`.
- Move to a new `docs/verification/`: 9 PNG screenshots (2 localization, 7
  Pathao/courier), 7 small `ticket12-check*.log` files, and
  `screenshot-removal-browser-result.json`; move and update links for
  `ticket07-browser-verification.md` and `remote-migrations-verification.md`.
- Remove 25 temporary artifacts: 5 CJS probes, 3 TSX previews + 1 HTML harness,
  8 Python probes/one-time scripts, 2 large server logs, and 6 JSON reports that
  contain development-database hostnames or internal IDs. Summarize safe outcomes
  in the moved reports first; never track the target metadata.
- Redirect `scripts/cleanup-phase1-orders.py` reports from
  `.scratch/pathao-courier/` to `.cache/cleanup-phase1-orders/`, create the
  directory before writing, and update the ticket-11 instructions. Do not run it.
- Retain `backend/tests/buyer_browser_demo.py`; it has no caller after probe
  removal but is unique offline browser setup. Record its invocation for ticket 09.

**Split before starting if needed:** 02a = records/evidence relocation and link
repair; 02b = artifact removal plus producer path change. Do not mix these with
feature organization.

**Required checks:** `rg` for every moved/removed path in active records, docs,
and scripts; `python -m py_compile scripts/cleanup-phase1-orders.py`; backend Ruff
on `scripts`; `npm run test:tooling`; final `npm run check`. Browser/PostgreSQL/
live-provider gates stay NOT RUN unless actually executed safely.

