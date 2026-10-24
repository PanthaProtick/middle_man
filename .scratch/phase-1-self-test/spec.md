# Phase 1 local synthetic self-test readiness

Status: ready-for-agent
Prepared: 2026-10-24
Owner/operator: project owner
Evidence baseline: inspected at commit `b4269f7ee4adc914f21794672331ac2cf35fab6b`, with the approved readiness documentation in the working tree.

## Problem Statement

The project owner wants to exercise Phase 1 personally as both seller and buyer,
using synthetic orders and payment evidence. Existing workflow implementations and
provider connectivity checks do not establish a usable, authenticated, durable
application: real seller verification is unfinished, public buyer access denies
requests, screenshots default to process memory, and database initialization can
leave a memory fallback available. Token encryption and payment-marker secrets are
also coupled to Clerk credentials.

The owner needs a repeatable local workflow with explicit failure behavior and
evidence of what works before testing Gemini, hosting the application or involving
real sellers. No real sellers, orders or payment records belong in this milestone.

## Solution

Make the existing Phase 1 workflow usable locally with real Clerk test sessions,
a dedicated Neon development database, generated screenshots in a private ignored
local folder and Gemini assistance disabled. Preserve offline development as an
explicit separate mode. Finish buyer-link authorization, revocation and reissue
without changing order terms, payment single use or seller-only decision authority.

The project owner controls two test seller identities and acts as buyer through
the ordinary public link. Provide repeatable happy-path, negative, concurrency,
restart and retention checks. Completion may be described only as **local synthetic
self-test passed**; it does not establish hosted acceptance, live AI quality,
payment-provider verification or seller benefit.

## User Stories

1. As the project owner, I want a documented local self-test configuration, so that I can exercise the real integration without exposing a public service.
2. As the project owner, I want an identified dedicated Neon development target, so that synthetic records stay separate from shared or real operations.
3. As a developer, I want offline development to remain explicit, so that ordinary tests still run without live credentials.
4. As a test seller, I want to sign in and out with Clerk, so that the workspace reflects my verified session.
5. As a test seller, I want expired or invalid sessions rejected, so that my data is inaccessible after authorization ends.
6. As the owner of one test shop, I want the other test identity excluded from every private operation, so that shop ownership is enforced consistently.
7. As a test seller, I want receiving-account details and agreed order terms preserved, so that later account edits cannot change an existing agreement.
8. As a test seller, I want to create and retrieve a unique buyer link, so that I can open the buyer workflow in a separate browser context.
9. As a test buyer, I want to view public terms and submit without an account or OTP, so that I can complete the seller-assisted workflow.
10. As a test buyer, I want separate contact and payment sender numbers, so that another person's payment does not invalidate my contact details.
11. As a test buyer, I want manual submission without a screenshot or AI, so that optional assistance never blocks the order.
12. As a test buyer, I want to attach a generated screenshot, so that I can test the intended upload workflow.
13. As a test seller, I want screenshots to survive application restart and remain private, so that evidence availability does not depend on process memory.
14. As the operator, I want screenshot files excluded from Git, so that running the test does not add uploaded files to source history.
15. As a test buyer, I want clear upload limits and recoverable errors, so that invalid or interrupted uploads do not silently succeed.
16. As a test buyer, I want an uncertain submission retry to resolve the original outcome, so that I do not submit twice.
17. As a test buyer, I want status access after an on-time submission, so that the initial deadline does not hide a still-pending order.
18. As a test seller, I want buyer corrections restricted to my verified identity, so that link possession cannot overwrite submitted information.
19. As a test seller, I want to revoke link access without cancelling an order, so that a leaked link cannot keep exposing public information.
20. As a test seller, I want to reissue a link for the same order, so that access can recover without changing terms or moving its payment.
21. As a test seller, I want reissue retries to return the original result, so that a lost response does not rotate the link repeatedly.
22. As a test seller, I want the predecessor link kept separate from a replacement, so that previous holders cannot discover the successor.
23. As a test seller, I want synthetic SMS import and manual transaction entry, so that both supported and unsupported payment inputs are testable.
24. As a test seller, I want exact matches to confirm once with correct remaining COD, so that repeated observations cannot create funds.
25. As a test seller, I want competing claims and evidence conflicts held for review, so that timing alone cannot select a winner.
26. As a test seller, I want audited corrections and explicit payment exceptions, so that accepted amounts and history remain explainable.
27. As a test seller, I want cancellation and replacement to preserve consumed-payment protection, so that lifecycle changes do not permit double use.
28. As the operator, I want database startup and runtime failures to fail explicitly, so that memory-only success cannot masquerade as durable acceptance.
29. As the operator, I want restart and concurrent-actor tests, so that persistence and single use are proven beyond one process.
30. As the operator, I want application secrets independent of Clerk credentials, so that authentication credential changes do not break saved links or replay protection.
31. As the operator, I want missing or incompatible application keys rejected, so that a configuration change cannot silently abandon historical protection.
32. As the operator, I want controlled-time cleanup tests and visible retries, so that retention can be verified without waiting months.
33. As a test seller, I want copy, CSV and mobile browser journeys checked, so that the whole workflow is usable beyond API calls.
34. As the operator, I want Gemini disabled even when credentials exist, so that the initial self-test transfers no data to AI providers.
35. As the operator, I want evidence recorded per acceptance case and release revision, so that completion claims are reproducible.
36. As the project owner, I want later AI, Drive storage and hosted testing separated, so that local success does not imply those integrations are ready.

## Implementation Decisions

### Scope, configuration and ordering

- Extend the existing Phase 1 modules; do not reimplement matching, corrections,
  exports or retention merely to demonstrate them. Preserve typed contracts,
  feature colocation, bounded module sizes and unrelated starter behavior.
- Separate explicit offline development from the integration self-test. The latter
  requires real seller verification, durable persistence, stable application secrets
  and private storage. Mock headers, dependency overrides or environment names alone
  cannot establish self-test readiness or grant real access.
- Verify the intended development target before schema operations. Inventory current
  migrations, rehearse them on a disposable target, and use additive changes for new
  access state. Do not reset persistent data as a shortcut to compatibility.
- Establish stable application secrets and database failure behavior before writing
  the persistent dataset; finish auth, buyer policy and storage before browser acceptance.
- Disable AI at backend entry points and frontend controls for this milestone,
  including direct API requests and replays. Configured Gemini credentials must not
  override that choice. Preserve existing extraction contracts for future evaluation.

### Seller authentication and durable persistence

- Integrate real Clerk sign-in/out and session-token acquisition into the seller
  application. Derive shop ownership solely from verified identity; remove the mock
  token default from this path. Handle session expiry without showing stale private data.
- Verify signature with trusted keys, expected issuer, expiration and applicable
  authorized-party/audience constraints. Support signing-key refresh and distinguish
  invalid credentials from verifier unavailability with typed 401/503 outcomes.
  Bind trusted key discovery to configuration, never an untrusted token-supplied URL.
- Cover every private surface: accounts, orders, receipts, corrections, decisions,
  evidence, exports, histories and retention. Do not leak existence across shops.
- In integration mode, missing/invalid database configuration or failed initialization
  must prevent successful application writes. Runtime outages yield explicit failure
  or same-key recovery of a committed result, never a switch to process memory.
- Verify adapter queries, schema compatibility, restart persistence and all-or-nothing
  mutations. Preserve the existing shop-first serialization and atomic allocation,
  audit, marker and idempotency transaction boundaries.

### Application secrets

- Use separate stable secrets for saved-link encryption and payment-identity HMAC,
  independent of authentication credentials. Do not store raw keys in the database,
  logs, evidence records or source control. No fixed fallback key in integration mode.
- Preserve marker-key binding checks. Missing/incompatible keys must fail explicitly
  rather than regenerate historical markers under a new key or ignore old protection.
- Inspect existing encrypted links and markers before changing key sources. If data
  exists, require a verified compatibility/migration path or retain the original key
  material; never silently discard records. Full online key-rotation machinery is
  not required for this fresh synthetic milestone, but unsupported changes fail closed.

### Buyer access and link lifecycle

- Explicitly enable the agreed policy for the self-test; keep unconfigured public
  access denied. Link possession permits allowlisted order terms/status and the first
  completed submission without sign-in or OTP. It grants no buyer identity guarantee.
- Accept forwarding risk for public terms and first submission. Exclude buyer personal
  fields, screenshots, raw receipts and internal review reasons from public responses;
  seller corrections and evidence reads require verified owning-shop authorization.
- Preserve the server-side 48-hour initial-submission deadline. Submitted pending
  orders do not automatically expire; retained, unrevoked links continue showing
  status. No second submission or buyer correction; same-operation retries resolve
  the original result under existing mutation-key rules.
- New uploads require an eligible unsubmitted/unexpired order. Enforce lifecycle,
  evidence ownership and current access state for every public operation and replay,
  before reading storage, returning cached outcomes or performing work.
- Add typed seller revoke/reissue operations and workspace controls. Revocation
  denies all public reads/writes without cancelling the order or altering allocation.
  Reissue gives the same order a fresh opaque token, permanently invalidates the old
  one and preserves original terms, expiry, submission state and allocation. It cannot
  revive expired/cancelled/replaced orders or reopen initial submission.
- Persist access state and audit mutations. Use existing transaction/locking and
  idempotency conventions; stale versions or changed-payload key reuse conflict.
  A retry must not rotate again, and an older cached response cannot reactivate a
  superseded token. Revocation/reissue races with public mutations must serialize.
- An unrevoked predecessor link reveals only its own terminal status after replacement;
  it cannot submit, upload, redirect to or expose the replacement token. Retention and
  explicit revocation still override that visibility.
- Keep private/no-store responses, referrer protection and token-safe logging.
  Bound ingress before buffering and enforce explicit configurable request/upload
  limits, including invalid-token traffic; use typed rejection/retry outcomes. This
  local control is not a claim of distributed hosted abuse protection.

### Evidence storage and retention

- Wire the existing storage interface to a persistent repository-local folder
  excluded through Git ignore rules before files are created. Verify no evidence
  files are tracked. Git ignore is not access control; never mount this folder as
  public static content. Resolve opaque storage identifiers within the intended root.
- Normalize filesystem read/write/delete failures into the application outage
  contract. Handle partial writes, database rollback and orphan cleanup; do not mark
  uploads or deletion successful before the corresponding storage action succeeds.
- Keep image validation and per-order limits. Test private retrieval, restart
  persistence and body-size rejection before whole-body allocation.
- Reuse retention processing and failure reporting. Provide a documented repeatable
  local cleanup invocation; prove retry/overdue behavior with controlled time.
- Preserve 30-day raw deadlines, 12-calendar-month completed personal-record rules,
  unresolved dependencies and minimal used-payment markers. Reprocessing does not
  reset raw deadlines. Deleting personal data cannot make a consumed payment reusable.
- A future Drive solution remains an option, not a selected provider or an upload
  mirror. Its access, identifiers, quotas, deletion, backups and recovery need separate
  assessment. No real-data deletion or provider-purge readiness is claimed here.

## Testing Decisions

- Use the testing seams approved in the interview: API behavior as the primary
  automated seam, real PostgreSQL for durability/concurrency, existing feature UI
  tests for interactions and actual local browser journeys for integration.
- Assert externally visible responses, durable state, privacy boundaries and
  recoverability. Avoid tests of private helpers, mocks proving themselves or
  assertions coupled to incidental component structure.
- Follow existing ASGI route tests for permission/validation/error cases, isolated
  PostgreSQL tests with independent actors for transaction behavior, and existing
  seller/buyer component tests for session, retry, upload and polling interactions.
  Existing fake identity/public-policy overrides are unit-test infrastructure only.
- Ordinary automated tests remain offline and use explicit verifier/storage/clock
  seams. Real Clerk/Neon browser acceptance is a separately recorded integration
  activity, not a live-credential dependency of the default root gate.
- Execute actual PostgreSQL cases, including concurrent manual/automatic allocation,
  competing claims, corrections/cancellation races, access revocation/reissue races,
  restart and outage recovery. Never run destructive fixtures against the persistent
  manual self-test dataset or another shared database.
- Test two owner-controlled Clerk identities, invalid/expired/foreign tokens,
  unavailable verification, sign-out/session expiry and all private shop surfaces.
- Add regressions for fail-closed startup, independent secrets, disabled AI with
  configured credentials, revoked-token replay, link reissue idempotency, original
  deadline preservation, predecessor isolation and storage I/O failures.
- Map every original AC01–AC50 case to dated evidence or an explicit deferred portion
  using the approved self-test checklist. AC10 live extraction behavior remains
  deferred; disabled/manual behavior must pass now. Synthetic SMS cannot prove
  representative bKash/Nagad parsing. Provider backup purge is documented as unproven.
- Run a local browser with real sessions, the intended database and generated images:
  setup, order/link, manual submission, optional upload, receipt arrival, confirmation,
  exceptions, corrections, lifecycle/access changes, restart and failure recovery.
  Include mobile layout, keyboard/errors, offline/visibility polling, actual clipboard
  paste and CSV import with Bangla/formula-like values. HTTP interception is insufficient.
- Use controlled time for expiry/retention. Record exact commands, release revision,
  database execution/skips and evidence/log paths. Use focused tests during edits;
  run root `npm run check` strictly as the final implementation handoff gate.
- Completion requires all applicable local cases, executed PostgreSQL checks,
  recorded browser results and a passing final root gate. Any skipped required case
  remains outstanding. No application checks have been run by writing this spec.

## Out of Scope

- Real sellers, real orders, real payment evidence or claims of seller benefit.
- Hosted deployment, production provisioning, public pilot invitations and migration
  of an unverified target. Permission to write this spec authorizes none of these.
- Enabling/live-testing Gemini, AI quality or provider privacy/retention acceptance;
  schedule a separately reviewed synthetic AI test after local completion.
- Selecting or integrating Drive/cloud object storage, distributed rate limiting,
  production backup purge verification or hosted disaster-recovery certification.
- Changing matching criteria, adding independent payment-provider verification,
  refund/credit handling, split payments, courier integration, teams/roles,
  notifications, native apps or broad analytics.
- Replacing or reopening the original 19 Phase 1 implementation tickets solely
  because their completed behavior requires integration evidence here.

## Further Notes

- The owner confirmed the consolidated interview plan and requested `to-spec`.
  This is the authoritative implementation delta for the local self-test, not a
  declaration that original Phase 1 implementation or acceptance has passed.
- Source decisions: [readiness plan](../../docs/phase-1-readiness-plan.md),
  [self-test checklist](../../docs/phase-1-self-test.md),
  [domain glossary](../../GLOSSARY.md),
  [independent secrets ADR](../../docs/adr/0002-independent-application-secrets.md),
  [buyer-link authority ADR](../../docs/adr/0003-buyer-link-authority.md).
- Preserve the [original behavioral specification](../phase-1-order-confirmation/spec.md)
  and [AC01–AC50](../phase-1-order-confirmation/acceptance.md), supplemented by the
  approved access/reissue cases above. Update owning tickets for changed behavior
  and exact evidence; do not treat old publication snapshots as current implementation status.
- No implementation tickets, application changes, deployments, migrations or live
  provider requests are created by this specification publication. Suggested first
  implementation slice: explicit durable integration mode and independent application
  secrets, followed by authentication, buyer access lifecycle and durable evidence.
