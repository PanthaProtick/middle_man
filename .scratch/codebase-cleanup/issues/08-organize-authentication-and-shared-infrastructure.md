# 08: Organize authentication and shared infrastructure

**Status:** ready-for-agent

**What to build:** Remaining authentication and cross-feature infrastructure with explicit ownership and discoverable tests, preserving authorization and offline development behavior.

**Blocked by:** 04 — Organize buyer workflows; 05 — Organize seller shell and order workflows; 06 — Organize payment and reconciliation workflows; 07 — Organize courier workflows.

- [ ] Reconcile inventory and preceding-ticket follow-ups before choosing shared targets; do not reopen unrelated completed cleanup.
- [ ] Trace authentication/session, configuration, client/server communication, and genuinely shared helper callers and tests; preserve feature-specific ownership when reuse is only superficial.
- [ ] Organize oversized responsibilities and related tests without introducing a generic shared module merely to shorten feature files.
- [ ] Preserve seller authority, shop isolation, session-loss recovery, independent application secrets, buyer-link boundaries, and private-data handling.
- [ ] Preserve offline standby/test behavior, stable contracts, localization preference behavior, and optional integration gates.
- [ ] Verify imports, collection, fixture isolation, and existing high-level authentication/API/rendered behavior; retain failure and security assertions.
- [ ] Review suppressions against actual tooling and behavior rather than deleting comments mechanically. Apply agreed size rules with narrow documented test exceptions.
- [ ] Verify bounded groups, then run final root `npm run check`; record dispositions and remaining convention/tooling follow-up.

