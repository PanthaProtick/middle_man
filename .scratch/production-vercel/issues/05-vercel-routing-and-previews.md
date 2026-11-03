# 05: Vercel deployment and isolated preview routing

**What to build:** The operator can prepare two reproducible Vercel projects for the frontend and API, with direct buyer-link routing and preview environments isolated from production data.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Expose the existing FastAPI application through a supported Vercel entry point and configure the Vite frontend separately from the same repository.
- [ ] Pin compatible runtimes and reproducible production dependencies; verify imported runtime packages are declared directly where appropriate.
- [ ] Configure SPA fallback so direct buyer-link navigation and refresh load the portal; configure the API base URL at build time.
- [ ] Configure exact frontend origins for backend CORS and Clerk authorized-party checks; arbitrary preview origins do not acquire production trust.
- [ ] Provide separate production and preview environment templates and instructions that prevent previews from using production write access. Backend secrets never enter frontend bundles or logs.
- [ ] Document owner-supplied domains, DNS, regions, plan constraints, production Git branch, and matching Clerk instance setup. Do not purchase plans, configure accounts, or deploy remotely in this ticket.
- [ ] Verify routing/build configuration and runtime packaging with appropriate local checks; record hosted and platform behaviors that still require ticket 09 acceptance.
- [ ] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact.
