# 06: Durable workflows across backend instances

**What to build:** Sellers and buyers can retry and resume work across backend replacement or concurrent instances without losing committed records, duplicating actions, or weakening payment protections.

**Blocked by:** 01: Repeatable clean-database initialization; 03: Production seller sessions and shop isolation; 04: Production buyer-link workflow; 05: Vercel deployment and isolated preview routing.

**Status:** ready-for-agent

- [ ] Separate application instances sharing PostgreSQL preserve seller orders, payment records, saved buyer links, and permitted buyer submissions across instance replacement.
- [ ] Exercise concurrent and retried writes to verify durable idempotency, payment single-use/reuse protection, and existing seller-confirmation boundaries.
- [ ] Audit database engine/session ownership against the selected runtime, including repeated requests, connection reuse, concurrency, cancellation, and cleanup. Change pooling or ownership only when evidence requires it.
- [ ] Classify process-local state: local caches may remain only where missing or stale entries do not change correctness; shared correctness protections must be durable.
- [ ] Document provider cooldown and request-coalescing limitations across instances without claiming deployment-wide coordination.
- [ ] Database loss produces explicit failure without false committed success. Stable application secrets preserve link recovery and payment protections across replacement.
- [ ] Use real disposable PostgreSQL for multi-instance and concurrency tests, and record the runtime exercised. Keep simulated/local evidence separate from deployed runtime acceptance.
- [ ] Run focused checks and final root `npm run check`; record exact results, the fresh result artifact, and any blocked integration evidence.
