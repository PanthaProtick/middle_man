# 07: Deployment-wide public admission protection

**What to build:** Public requests face a documented, verifiable deployment-wide admission control with bounded bodies and actionable rejection behavior across backend instances.

**Blocked by:** 05: Vercel deployment and isolated preview routing.

**Status:** ready-for-agent

- [ ] Select a verified platform control or shared limiter and record its scope, supported plan, configuration, failure behavior, and operational constraints before public launch.
- [ ] Demonstrate that aggregate requests across instances cannot bypass the intended deployment-wide limit; a per-worker quota alone does not satisfy acceptance.
- [ ] Preserve existing body limits and buyer-link authority; rejected or failed requests return actionable errors without simulated success or leaking sensitive data.
- [ ] Keep provider cooldown/coalescing limits distinct from public admission protection and document their cross-instance limitations.
- [ ] Add meaningful tests or reproducible control verification for accepted requests, rejected requests, cross-instance enforcement, and relevant control failures. Offline development remains possible.
- [ ] Provide deployment and operator verification instructions; record actual deployed enforcement as pending until ticket 09 if no hosted verification occurred.
- [ ] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact.
