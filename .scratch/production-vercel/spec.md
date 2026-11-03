# Production hosting on Vercel with Neon and Clerk

Status: draft — awaiting confirmation of testing seams
Date: 2026-11-03

## Problem Statement

The owner wants to host Middleman on Vercel using a clean Neon production branch
and a new Clerk production instance. Local application behavior and configured
credentials do not establish hosted readiness. Buyer access currently rejects
production requests, and deployment wiring and clean-database initialization
need to be made explicit before real orders are collected.

## Solution

Prepare a repeatable deployment of the React frontend and FastAPI backend on
Vercel, backed by Neon and production Clerk authentication. Preserve buyer-link
authority, seller confirmation, and payment semantics. Fail explicitly when
durable storage or authentication is unavailable. Supply a deployment runbook
that takes the owner from domain setup through schema initialization, secrets,
deployment, acceptance, and recovery.

The implementation must distinguish code readiness, successful deployment,
hosted acceptance, and authorization to invite real users.

## User Stories

1. As the owner, I want a documented hosting layout so that each service has a clear responsibility.
2. As the owner, I want separate production and preview configuration so that previews cannot change production data.
3. As the owner, I want production Clerk setup instructions so that authentication uses the intended instance.
4. As the owner, I want domain and DNS instructions so that frontend, API, and Clerk use compatible origins.
5. As the owner, I want the clean database target verified before migration so that another branch is not modified accidentally.
6. As the owner, I want ordered, recorded migrations so that schema changes are repeatable and auditable.
7. As the owner, I want migration failures to stop initialization so that partial setup is not reported as success.
8. As the owner, I want production startup to reject missing storage, schema, auth, or required secrets so that misconfiguration is visible.
9. As a seller, I want to sign in and out with Clerk so that my shop requires a verified session.
10. As a seller, I want my data isolated from other sellers so that another account cannot read or change it.
11. As a seller, I want committed orders and payment records to survive backend replacement so that serverless scaling cannot lose work.
12. As a seller, I want retries to preserve existing idempotency and payment reuse protections so that network failures do not duplicate actions.
13. As a seller, I want buyer links to remain usable across redeployments so that sharing does not depend on an individual backend instance.
14. As a buyer, I want to open or refresh my link directly so that the hosted portal loads without first visiting the homepage.
15. As a buyer, I want to view only the public terms and status allowed by my link so that private details are not exposed.
16. As a buyer, I want to make the permitted initial submission so that the seller can review delivery and payment details.
17. As a buyer, I want expired, revoked, or invalid links rejected consistently so that link lifecycle rules remain meaningful.
18. As a buyer, I want bounded requests and actionable failures so that errors do not silently become simulated success.
19. As the owner, I want secrets excluded from frontend bundles and logs so that deployment does not expose credentials.
20. As the owner, I want scheduled retention maintenance so that hosting preserves the existing deletion policy.
21. As the owner, I want real courier booking to require a separate explicit opt-in so that deployment alone cannot create external bookings.
22. As the owner, I want hosted acceptance evidence and recovery instructions so that I can assess readiness and respond to failure.

## Implementation Decisions

- Use two Vercel projects from the same repository as the initial deployment
  layout: one Vite frontend and one FastAPI backend. Domain names, Vercel plan,
  regions, and production Git branch remain owner-supplied configuration.
- Expose the existing FastAPI application through a supported Vercel entry point.
  Pin compatible runtime versions and install reproducible production dependencies.
  Verify required imported packages are declared directly where appropriate.
- Configure frontend SPA fallback for direct buyer-link navigation. Configure the
  API base URL at build time and exact frontend origins for backend CORS and
  Clerk authorized-party checks. Do not broaden production trust to arbitrary previews.
- Preserve the authority boundary already defined by ADR-0003: buyer-link
  possession permits public terms/status and initial submission, not buyer
  identity, seller authority, private evidence access, or unrestricted corrections.
- Add an explicit production buyer-access policy setting, separate from the
  existing local self-test policy. Default to disabled; enable only the documented
  link-possession policy. Unknown values must fail configuration validation.
  Preserve existing expiry, revocation, projection, submission, and correction rules.
- Validate production seller verification configuration at startup as well as
  enforcing cryptographic verification and shop authorization on requests.
  Development credentials or identity overrides must not grant production access.
- Require durable application storage in production. Preserve explicit database
  failure responses; no memory fallback or simulated response may imply a committed write.
- Audit existing engine and session behavior against the actual Vercel lifecycle,
  including repeated requests, concurrency, connection reuse, cancellation, and
  cleanup. Change pooling or engine ownership only when evidence requires it.
- Classify process-local state by responsibility. Caches may remain local if stale
  or missing entries do not change correctness. Shared correctness, idempotency,
  and payment protections must remain durable. Document provider cooldown and
  coalescing limits across instances rather than claiming global coordination.
- Preserve request-body limits. Establish deployment-wide public admission
  protection through a verified platform control or shared limiter; a per-worker
  quota alone must not be represented as a deployment-wide limit. Record the
  selected mechanism and plan constraints before public launch.
- Initialize the confirmed clean Neon target through an explicit migration command
  using a direct connection. Use ordered migrations, an applied-version/checksum
  ledger, serialization against concurrent runners, and transactions where supported.
  Reject changed applied migrations and ambiguous existing schemas. Report failure
  without secrets; rerunning a completed initialization must be safe.
- Keep schema migration separate from request startup and ordinary frontend builds.
  Runtime uses the pooled database connection. Readiness must detect incompatible
  schema beyond merely finding table names where contracts depend on columns.
- Store independent, stable link-encryption and payment-marker secrets in backend
  environment settings. Add a dedicated courier credential key only when needed.
  Document backup and rotation consequences; never rotate these on each deployment.
- Configure Clerk production keys and issuer consistently across frontend and API.
  Do not configure a webhook from example comments unless an implemented workflow
  needs one. Keep secret keys out of public build variables.
- Provide authenticated, retry-safe scheduled execution of existing retention
  operations. Reuse current lifecycle rules and record scheduling, failure visibility,
  and operator recovery. Do not revive retired screenshot storage or catalogue crawling.
- Keep production Pathao booking disabled by default. Optional AI and live provider
  acceptance are separate from core hosting acceptance; preserve manual workflows.
- Deliver configuration templates and an operator runbook with environment scopes,
  initialization order, health checks, acceptance steps, and recovery. Application
  rollback must account for schema compatibility; restoring data is a separate action.

## Testing Decisions

- Prefer existing external seams: FastAPI HTTP requests for backend contracts and
  browser interactions for frontend routing and complete hosted workflows. Avoid
  adding internal interfaces solely to mirror implementation details in tests.
- Extend existing public-order, link-lifecycle, seller-authentication, durable-storage,
  and retention tests. Cover disabled/allowed production policy, invalid settings,
  expired/revoked links, rejected private access, submission retries, invalid sessions,
  cross-shop access, and explicit storage failures. Retain offline test operation.
- Use disposable PostgreSQL integration tests for clean initialization, repeat
  execution, concurrent migration runners, checksum mismatch, failed migration,
  and schema readiness. Mock SQL behavior is insufficient evidence for these cases.
- Verify persistence and retry correctness across separate application instances
  sharing one database. Exercise database-engine reuse under the selected runtime.
- Verify retention authorization, repeat execution, policy cutoff boundaries, and
  failure reporting without deleting unrelated or ineligible records.
- Run focused tests after each bounded cluster. Run root npm run check as the final
  code/tooling gate and record its fresh result artifact.
- Separately perform hosted acceptance with real Clerk sessions and isolated
  synthetic data: sign-in/out, two-seller isolation, order creation, direct buyer-link
  navigation and refresh, submission, seller review, persistence across instances,
  and expiry/revocation. Verify scheduled maintenance and deployed ingress controls.
- Report local, PostgreSQL, hosted browser, and live-provider evidence separately.
  Unrun or blocked checks remain explicit; deployment success does not pass them.

## Out of Scope

- Redesigning seller/buyer screens or changing order, payment, or courier business rules.
- Treating buyer claims as independently verified payments or introducing buyer identity verification.
- Automatically enabling real Pathao bookings, paid AI, or provider credentials.
- Copying development users, orders, or payment records into production.
- Changing unrelated in-memory template item endpoints into durable product workflows.
- Purchasing domains, choosing paid plans, deploying, applying remote migrations,
  or collecting real customer data as part of writing this spec.

## Further Notes

- The existing production buyer gate is a confirmed blocker. Runtime compatibility,
  migration tooling, shared ingress protection, and scheduling need implementation
  evidence; they are not assumed broken or solved solely from configuration.
- The database branch is described by the owner as clean. Verify that claim and the
  exact target before any remote schema operation. Do not print credentials.
- Suggested implementation clusters: production access/auth boundaries; Vercel
  routing/runtime and environment isolation; migrations/readiness and retention;
  hosted acceptance and operator handoff. Each cluster must remain independently testable.
- Next action: confirm the proposed testing seams, then publish this record as
  ready-for-agent. No application files, accounts, or remote data changed in this step.
