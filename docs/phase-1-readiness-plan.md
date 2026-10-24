# Phase 1 readiness and next-phase exit plan

Prepared: 2026-10-24. Status: execution checklist; approval and completion are pending.

## Goal and scope

Finish Phase 1 as a reliable seller-assisted order-confirmation workflow before
expanding the product. This plan treats “next phase” as broader product development
after a controlled pilot. If the next milestone is only a private demonstration,
use synthetic data and report the remaining gates explicitly.

The approved [Phase 1 design](phase-1-design.md) and
[acceptance cases](../.scratch/phase-1-order-confirmation/acceptance.md) remain the
behavioral contract. This checklist coordinates readiness; it does not replace
the existing tickets or authorize deployment, database migration, or live-data use.

## Starting evidence

| Area | Evidence available | What remains unproven |
| --- | --- | --- |
| Gemini | Live generation succeeded with configured `gemini-3.5-flash-lite` | App extraction quality, failures, privacy terms and cost controls |
| Clerk | Secret-key and frontend signing-key requests returned 200; publishable keys match | Seller sign-in, session handling and backend token verification |
| Neon | Live connection succeeded; selected database had no public tables | Migrations, application queries, persistence and hosted recovery |
| Buyer-link copy | Shared copy control fixes false success, exposes manual fallback; regression and synthetic browser checks passed | Native browser permissions and pasting into another app |
| Application | Seller/buyer workflows, matching, corrections, exceptions, exports and retention have substantial implementations | Full hosted workflow and representative seller use |
| Verification | Earlier full checks passed, including the committed UI changes | A fresh gate for the final release candidate |

Provider checks establish credential connectivity, not application readiness.
The Neon observation applies to the database selected during that check, not every
branch or database in the Neon project. Do not put credentials or buyer data in
the evidence record.

## Execution order

Complete gates 1–3 before exercising the hosted buyer workflow. Gate 4 must pass
before collecting real screenshots or other raw evidence. Complete gates 5–7
before inviting pilot users, then gate 8 before beginning the next product phase.
Assign one accountable owner to each gate and record completion evidence below.

### 1. Establish durable database behavior

- [ ] Confirm the intended Neon project, branch and database; separate development,
  staging and production targets. Verify each target before any schema operation.
- [ ] Review and apply migrations `0001`–`0017` in order to the intended environment.
  Record applied versions and define how future deployments detect schema drift.
- [ ] Verify application startup and real queries through the app's database adapter,
  including TLS/pooler behavior; a direct connection probe is insufficient.
- [ ] Create a synthetic shop, account, order, submission, receipt and allocation;
  restart the application and verify the records, fixed terms and status persist.
- [ ] Simulate database unavailability: writes fail explicitly and never report a
  successful memory-only confirmation. Exercise migrations on a disposable target.
- [ ] Document backup retention, a restore procedure and the strategy for failed
  schema/application releases; prove a restore with synthetic records.

Exit evidence: migration inventory, sanitized app-level results, restart/outage
checks and restore result. Never run destructive test fixtures against shared Neon.

### 2. Complete real seller authentication and shop isolation

Current owners: [backend authentication](../backend/app/core/auth.py) and
[seller workspace](../frontend/src/features/seller/SellerWorkspace.tsx).

- [ ] Implement Clerk sign-in/sign-out and obtain session tokens in the frontend;
  remove the default mock seller identity from the live user path.
- [ ] Verify token signature, trusted issuer, expiry and applicable audience/authorized
  parties on the backend. Handle signing-key refresh and verifier outages explicitly.
- [ ] Derive shop ownership from the verified identity; reject development identities
  in production. Keep offline development behavior explicit and isolated.
- [ ] Test missing, expired, malformed and foreign-instance tokens, logout/session
  expiry, and verifier failure without exposing seller data.
- [ ] Use two real test seller identities to test cross-shop reads and writes for
  orders, accounts, receipts, corrections, evidence, exports and retention operations.

Exit evidence: real session reaches the owning shop; unauthorized/foreign requests
cannot read or mutate it. Clerk key availability alone does not satisfy this gate.

### 3. Decide and implement public buyer access

Current [public access gate](../backend/app/core/public_gate.py) denies requests.
Configured provider keys also disqualify the synthetic demo override.

- [ ] Approve an access/projection policy: what possession of the buyer link grants,
  which fields are visible before/after submission, and whether extra verification
  is required. Record expiry, replacement and revocation behavior.
- [ ] Implement the policy without removing authorization checks wholesale. Keep
  seller corrections and private evidence access behind seller authorization.
- [ ] Test invalid/expired/replaced links, token guessing, cross-order evidence IDs,
  sensitive-data exposure and buyer attempts to invoke seller actions.
- [ ] Define request/upload/AI rate limits and payload bounds with clear retry and
  recovery behavior; avoid logging full buyer tokens or personal information.

Exit evidence: hosted manual buyer submission and status viewing work under the
approved policy; forbidden projections and operations remain inaccessible.

### 4. Make evidence storage and retention operational

The current [file store](../backend/app/services/evidence_store.py) defaults to
process memory. A database connection does not make screenshot bytes durable.

- [ ] Wire durable private storage at startup. Choose a managed private object store
  or a persistent filesystem with explicit deployment, backup and access constraints.
- [ ] Verify restart persistence, unauthorized read rejection, image validation,
  upload/read/delete outages, and cleanup of partially failed uploads.
- [ ] Schedule raw-evidence cleanup and structured-retention processing; define the
  operator, cadence, retry behavior and alerts for overdue/failed deletion.
- [ ] Prove the 30-day raw and 12-calendar-month completed-record rules using controlled
  time. Preserve unresolved dependencies and minimal used-payment replay protection.
- [ ] Document storage versions/soft deletes, database backups, provider logs and
  restore handling under the [retention lifecycle](retention-lifecycle.md).
- [ ] Resolve account/shop deletion and unmatched-receipt retention before collecting
  real data; specify retained fields, purpose and user-facing deletion expectations.
- [ ] Assess stable encryption/fingerprint key management and rotation. Current
  token/reconciliation secrets depend on Clerk configuration; changing credentials
  must not silently break saved links or payment-reuse protection.

Exit evidence: private file survives restart, cleanup retries safely, and replay of
a previously consumed payment stays blocked after eligible personal-data deletion.

### 5. Validate payment inputs and optional Gemini assistance

- [ ] Exercise seller-observed receipts with consented, representative bKash/Nagad
  examples. Record supported parser formats and unsupported/masked cases.
- [ ] Keep unrecognized SMS unresolved with manual entry available. No guessed
  sender/time and no Gemini SMS-parser fallback. Never label seller evidence as
  independent payment-provider verification.
- [ ] Reverify exact-match rules, duplicate/conflicting observations, competing
  claims, corrections, manual exception amounts and payment single use in PostgreSQL.
- [ ] Test two concurrent database actors and restart/outage boundaries; at most one
  durable allocation may consume a receipt, including manual/automatic races.
- [ ] For enabled AI features, verify explicit opt-in/data-transfer explanation,
  reviewed results, incorrect/malformed/late responses, timeouts, quotas and manual
  fallback. AI output must never authorize payment acceptance.
- [ ] Confirm Gemini model availability, applicable data terms, retention commitments
  and usage limits. Disable optional AI for the pilot if these gates remain open.

Exit evidence: representative receipt results, durable contention tests and either
accepted live AI evidence or a documented manual-only pilot configuration.

### 6. Run the complete browser acceptance journey

Use synthetic records first, mobile buyer layouts and the actual hosted staging
frontend/backend. Record browser, release revision and results against AC01–AC50.

- [ ] Seller setup → account → fixed-term order → copy link → buyer opens it.
- [ ] Manual buyer form with a payer number different from contact; optional image;
  uncertain submission retry uses the same mutation key and resolves the outcome.
- [ ] Receipt arrives before/after submission; exact match confirms once; seller and
  buyer see consistent status and correct remaining COD.
- [ ] Mismatch/conflict/competing claim → seller review → audited correction or
  explicit exception; invalid versions/duplicate requests cannot silently overwrite.
- [ ] Cancel, reject and eligible replacement; 48-hour initial expiry; already
  submitted pending orders do not expire; confirmed payment terms stay immutable.
- [ ] Polling pauses/resumes on offline/visibility changes, backs off, ignores stale
  responses and stops after terminal status or navigation.
- [ ] Clipboard success, denial and absence in list/detail views; paste the exact
  link and delivery summary into another application. Import CSV into the intended
  spreadsheet and check Bangla text, quoting, formula safety and export limits.
- [ ] Verify keyboard access, readable errors, loading/retry states and mobile
  layout. Run a manual-only journey while Gemini is unavailable.

Exit evidence: linked browser observations for each applicable case, with failures
and deferred cases explicit. Intercepted HTTP tests do not prove live integration.

### 7. Prepare and verify the pilot release

- [ ] Configure HTTPS, allowed frontend origins, environment-specific secrets and
  production mode. Verify the deployed app uses the intended providers and schema.
- [ ] Set operational limits for the small pilot; measure matching latency and shop
  lock contention under expected use before promising higher throughput.
- [ ] Establish sanitized error monitoring, provider/storage/cleanup alerts, an
  incident owner and a rollback or feature-disable procedure. Rehearse recovery.
- [ ] Run focused regressions during changes and root `npm run check` on the final
  candidate. Record exact result/log paths and skipped PostgreSQL cases separately.
- [ ] Complete staging and deployed smoke/browser checks; verify a fresh seller
  session and public buyer journey after deployment.
- [ ] Reconcile README, implementation tickets and readiness labels with evidence;
  configuration badges and old “completed” labels must not imply launch acceptance.

Exit evidence: identified release revision, full local gate, hosted acceptance,
known limitations and operator readiness. No unresolved critical data-isolation,
payment-reuse, data-loss or privacy failure may enter the pilot.

### 8. Measure the pilot and make the next-phase decision

- [ ] Follow the [baseline procedure](pilot-baseline-measurement.md): observe 3–5
  candidate sellers over 20–30 consecutive orders, recording whole-workflow effort.
- [ ] Agree pilot success thresholds before starting: handling-time improvement,
  buyer completion, exception workload and acceptable reliability. The existing
  50% verification-time improvement is an example target, not an achieved result.
- [ ] Compare baseline and repeat pilot use, including SMS/manual-entry effort,
  correction time and delivery preparation. Collect privacy-safe aggregate measures.
- [ ] Record abandonment, support requests, incorrect acceptances and operational
  incidents; distinguish observed seller acceptance from verified payment truth.
- [ ] Resolve critical defects, document residual limitations and explicitly decide
  proceed, extend pilot or revise Phase 1. A small pilot cannot establish broad
  fraud-prevention or COD-return claims.

Exit evidence: pilot report and recorded next-phase decision backed by observed use.

## Completion record

For each gate, record owner, status (`NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `PASS`),
release revision, dated evidence links and outstanding issues. Update existing
implementation tickets rather than creating duplicate histories. An unchecked box
means evidence is still required, even if related code already exists.

## Keep outside this plan

Defer courier booking/tracking, direct payment-provider verification, split payments,
one payment across multiple orders, refunds/credit, teams/roles, native apps,
notifications/bots and broad analytics until the exit decision. A deferred item
becomes Phase 1 work only if evidence shows it is necessary for safe pilot operation.
