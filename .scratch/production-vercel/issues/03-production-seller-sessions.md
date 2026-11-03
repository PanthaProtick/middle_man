# 03: Production seller sessions and shop isolation

**What to build:** Sellers use production Clerk sessions to access only their own shop, with consistent frontend and API authentication configuration and explicit rejection of unauthorized access.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Trace and preserve the seller sign-in/out and authenticated request flow; production requests enforce cryptographic session verification and shop authorization.
- [ ] Reject invalid or expired sessions, incompatible issuer or authorized-party configuration, development credentials, and identity overrides in production.
- [ ] Contract tests cover two sellers and cross-shop reads and writes; possession of another shop or order identifier does not grant access.
- [ ] Document matching frontend/API Clerk production configuration, exact trusted origins, and sign-in/out acceptance steps without exposing backend secrets in public variables.
- [ ] Do not introduce a webhook based solely on example configuration; add one only if an implemented workflow requires it.
- [ ] Keep automated tests offline with existing external seams; clearly separate those results from real hosted Clerk acceptance in ticket 09.
- [ ] Run focused checks and final root `npm run check`; record exact results and the fresh result artifact.
