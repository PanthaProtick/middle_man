# 10: Verify the complete cleanup

**Status:** ready-for-agent

**What to build:** A reviewable final cleanup outcome demonstrating the approved acceptance criteria, with honest limits and no unexplained coverage losses.

**Blocked by:** 09 — Prevent convention and artifact regressions.

- [ ] Audit completion and evidence from every preceding ticket, including all spec acceptance criteria A1–A8; do not equate ticket status alone with demonstrated acceptance.
- [ ] Reconcile candidate dispositions against the final checkout, preserving unrelated work and recording retained uncertainties or narrow documented exceptions.
- [ ] Confirm scratch contains only allowed work records, retained artifacts have appropriate ownership, active references resolve, and disposable-output producers use ignored cache storage.
- [ ] Compare final test discovery and protected cases with the baseline; explain intentional additions/removals and verify no unique assertions, fixtures, or safety cases silently disappeared.
- [ ] Confirm agreed size/convention policy and documentation match the result; remaining work must be resolved or explicitly reported, not hidden with exclusions.
- [ ] Verify preserved contracts and relevant buyer, seller, payment, courier, authentication, localization, and offline behavior using existing high-level checks and prior-ticket evidence.
- [ ] Run final root `npm run check` after any final fixes; record the fresh result artifact, summaries, failures, skips, and blocked/unrun gates. Do not mark complete on a failed required gate.
- [ ] Report browser, physical-device, screen-reader, hosted, PostgreSQL, and live-provider acceptance separately; automated tests and HTTP smoke establish none of the unrun gates.
- [ ] Deliver a concise final summary of changes, deletion evidence, remaining exceptions, and actual verification. Do not deploy or run operational data cleanup.

## Work record

**Inventory bounds (2026-10-28):** Full map in
[disposition-record.md](../disposition-record.md).

- Compare final scratch content against the 143-file baseline: 101 Markdown work
  records retained (minus 2 relocated verification reports, plus records of this
  effort), 42 non-Markdown artifacts resolved (17 relocated, 25 removed).
- Compare test discovery against 101 backend modules, 78 frontend test files, and
  3 tooling suites; explain every intentional addition/removal and verify the
  split/exception list from tickets 05-08.
- Confirm 2 source files over 300 were split, 10 review-trigger source files were
  either decomposed or justified, and 15 over-300 tests were split or have narrow
  documented exceptions.
- Verify active links across `docs/`, `AGENTS.md`, `README.md`, `tasks/`, and
  `.scratch/`; confirm producers write only to ignored cache storage.
- Run a fresh root `npm run check` after final fixes and record the result artifact,
  failures, skips, and unrun browser/device/screen-reader/hosted/PostgreSQL/live
  gates. Do not claim unrun gates passed.

