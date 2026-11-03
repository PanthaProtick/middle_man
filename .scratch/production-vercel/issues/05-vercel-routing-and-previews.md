# 05: Vercel deployment and isolated preview routing

**What to build:** The operator can prepare two reproducible Vercel projects for the frontend and API, with direct buyer-link routing and preview environments isolated from production data.

**Blocked by:** None (can start immediately).

**Status:** in-progress

- [ ] Expose the existing FastAPI application through a supported Vercel entry point and configure the Vite frontend separately from the same repository.
- [ ] Pin compatible runtimes and reproducible production dependencies; verify imported runtime packages are declared directly where appropriate.
- [ ] Configure SPA fallback so direct buyer-link navigation and refresh load the portal; configure the API base URL at build time.
- [ ] Configure exact frontend origins for backend CORS and Clerk authorized-party checks; arbitrary preview origins do not acquire production trust.
- [ ] Provide separate production and preview environment templates and instructions that prevent previews from using production write access. Backend secrets never enter frontend bundles or logs.
- [ ] Document owner-supplied domains, DNS, regions, plan constraints, production Git branch, and matching Clerk instance setup. Do not purchase plans, configure accounts, or deploy remotely in this ticket.
- [ ] Verify routing/build configuration and runtime packaging with appropriate local checks; record hosted and platform behaviors that still require ticket 09 acceptance.
- [ ] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact.

## Implementation evidence (2026-11-04)

- Base: `9a92d6cac5bf1cea830a5aa440de7b75211a507a`; current branch retained.
- User approved ASGI HTTP and deployment configuration/build seams for TDD.
- Added independent frontend/backend Vercel roots, explicit `app.main:app` entry,
  SPA fallback, Node 22/Python 3.12 pins, refreshed locks, and direct runtime
  dependency declarations. Python lock pruning removes newer-runtime wheels.
- Added per-project Production/Preview example inventories and
  `docs/vercel-deployment.md`: scope isolation, exact origins, owner decisions,
  matching Clerk instances, platform constraints, and ticket 09 acceptance limits.
- Preview configuration rejects production mode/booking and requires explicit
  self-test mode for durable access; credentials still require separate resource
  permissions. Production Vercel mode cannot bypass production readiness.
- Initial regression run: 4 failed/1 passed before implementation; subsequent
  focused backend run: 14 passed. Tooling template check failed before templates
  existed, then 2 passed. `npm run typecheck`: passed both applications.
- Lock refresh: offline resolution lacked cache metadata; normal sandbox network
  was blocked; authorized network retry of `uv lock` succeeded (56 packages).
- Next: independent standards/spec review, final root check, record fresh artifact,
  resolve review findings, and commit final evidence. No remote changes performed.
