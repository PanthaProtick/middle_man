# 09: Hosted acceptance and operator handoff

**What to build:** The owner receives a complete deployment and recovery runbook plus evidence that distinguishes code readiness, successful deployment, hosted acceptance, and authorization to invite real users.

**Blocked by:** 02: Fail-closed production readiness; 06: Durable workflows across backend instances; 07: Deployment-wide public admission protection; 08: Authenticated scheduled retention.

**Status:** ready-for-agent

- [ ] Consolidate configuration scopes, owner-supplied decisions, domain/DNS and Clerk setup, database target verification, initialization order, deployment steps, and health checks into an operator runbook.
- [ ] Specify stable-secret backup and rotation consequences, rollback schema compatibility, and recovery steps; distinguish application rollback from data restoration.
- [ ] Before remote changes, obtain explicit authorization for the actual targets and actions. Earlier spec or ticket approval does not authorize deploying, applying remote migrations, purchasing services, or collecting customer data.
- [ ] After authorized setup, perform hosted acceptance with real Clerk sessions and isolated synthetic data: sign-in/out, two-seller isolation, order creation, direct buyer navigation and refresh, buyer submission, seller review, and persistence across instances.
- [ ] Verify hosted expiry/revocation, private access rejection, deployed ingress protection, scheduled maintenance, and observable failure/recovery behavior.
- [ ] Keep real Pathao booking disabled unless separately opted in. Optional AI and live-provider acceptance remain separate from core hosting acceptance, with manual workflows preserved.
- [ ] Record local, disposable PostgreSQL, hosted browser/runtime, and live-provider results separately, with reproducible evidence and explicit failed, blocked, or unrun gates. Deployment success alone does not satisfy acceptance.
- [ ] Run final root `npm run check` for any code/tooling changes and record its fresh artifact; record the applicable documentation checks for a documentation-only handoff.
- [ ] State whether public launch gates are satisfied; do not mark hosted acceptance complete or invite real users while required evidence or authorization is missing.
