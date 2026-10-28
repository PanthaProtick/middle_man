# 06: Organize payment and reconciliation workflows

**Status:** ready-for-agent

**What to build:** Payment records, matching, corrections, and order outcomes whose code and tests are organized by responsibility while financial-history and concurrency safeguards remain intact.

**Blocked by:** 02 — Clean scratch storage and fix artifact producers; 03 — Remove proven obsolete scaffolding.

- [ ] Bound work using the inventory and trace seller UI, endpoint contracts, domain services, storage adapters, fixtures, and affected tests before editing.
- [ ] Organize payment entry/import, evidence/history, reconciliation, corrections, and outcomes through existing responsibility boundaries; do not change payment semantics.
- [ ] Preserve seller-supplied evidence authority, shop and receiving-account isolation, payment single-use protection, deterministic matching, atomic transitions, replay behavior, and failure recovery.
- [ ] Preserve retention/privacy behavior and the removal of buyer payment screenshot functionality; historical development evidence must not reintroduce that feature.
- [ ] Preserve Bengali/English presentation, stored business data, English CSV contracts, and no-repeat mutation behavior where affected.
- [ ] Split oversized test responsibilities without weakening existing boundary, replay, contention, PostgreSQL transaction, and failure assertions; record narrow cohesive-test exceptions and verify discovery.
- [ ] Verify one bounded workflow at a time using existing high-level seams; retain optional integration gates without introducing live-credential requirements for offline checks.
- [ ] Run final root `npm run check`; record actual PostgreSQL/live-provider gates, retained uncertainty, and all evidence-backed dispositions.

