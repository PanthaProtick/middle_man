# 08: Authenticated scheduled retention

**What to build:** The operator can schedule authenticated, retry-safe retention maintenance with visible failures and a documented recovery procedure while preserving the existing deletion policy.

**Blocked by:** 01: Repeatable clean-database initialization; 05: Vercel deployment and isolated preview routing.

**Status:** ready-for-agent

- [ ] Provide a scheduling-compatible authenticated invocation of existing retention operations; reject missing or invalid scheduler authorization without granting seller impersonation.
- [ ] Preserve existing lifecycle rules, cutoff boundaries, shop scope, and payment-protection retention requirements; leave unrelated and ineligible records intact.
- [ ] Repeated or overlapping execution is safe, and partial failures remain observable and retryable without falsely reporting complete cleanup.
- [ ] Tests cover authorization, repeat execution, overlap where applicable, cutoff boundaries, failure reporting, and preservation of ineligible records. Use PostgreSQL for durable behavior evidence.
- [ ] Document scheduling cadence, platform/plan constraints, environment-scoped secrets, failure visibility, missed-run recovery, and safe operator retry.
- [ ] Do not revive retired screenshot storage or location catalogue crawling; verify deployed scheduling separately in ticket 09.
- [ ] Run focused checks and final root `npm run check`; record exact results, the fresh result artifact, and any unrun PostgreSQL gates.
