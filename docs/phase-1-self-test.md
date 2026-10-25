# Phase 1 local synthetic self-test

Status: consolidated plan confirmed; specification authorized; implementation pending.
Owner/operator: project owner. No execution evidence has been collected under this checklist.
Specification: [ready-for-agent implementation delta](../.scratch/phase-1-self-test/spec.md).

This is the immediate milestone under the [readiness plan](phase-1-readiness-plan.md).
Use synthetic orders, transaction records, SMS and generated screenshots. Real
Clerk test sessions and a dedicated Neon development database are required;
Gemini features are disabled. Local execution does not establish hosted readiness
or seller benefit. Do not copy production data into this environment.

## Dependency order

1. Identify the isolated database target and two owner-controlled Clerk test
   identities. Document the target without secrets. Keep destructive fixtures on
   disposable databases, separate from the persistent manual self-test dataset.
2. Implement dedicated token-encryption and payment-marker secrets before creating
   persistent records. Verify missing/incompatible secrets fail explicitly and
   Clerk credential changes preserve saved-link recovery and payment protection.
3. Establish database startup/outage failure behavior and rehearse migrations on a
   disposable target. Confirm schema inventory and app-adapter access. Never accept
   silent memory fallback when the self-test requires a database. Service-level
   fixtures are database evidence, not browser authentication/access evidence.
4. Complete real seller sign-in/out, token verification and identity-derived shop
   ownership. Verify both identities cannot access each other's data or actions.
5. Implement the agreed buyer-link policy, revocation and reissue. Preserve default
   denial when access policy is not enabled; a test dependency override is insufficient.
   Keep seller actions private. Do not expose replacement links through old links.
6. Wire durable screenshot storage into an ignored local folder. Verify Git ignores
   files before creating them, private reads, upload validation, failure cleanup,
   restart persistence and deletion retries. Bound request bodies before full
   buffering and define configurable request limits and clear retry responses.
7. Execute the acceptance matrix below, including actual PostgreSQL contention,
   local browser journeys and controlled-time cleanup/expiry cases. Fix failures
   using focused checks, then run root `npm run check` on the final candidate.

Implementation should resolve exact configuration names, numeric development
limits and file layout using repository conventions. These are engineering choices;
they must not silently change the agreed access or order-lifecycle behavior.

## Acceptance matrix

Buyer-link reads and initial submission require both `SELF_TEST_MODE=True` and
`PUBLIC_BUYER_ACCESS_POLICY="self_test_link_possession"` in the backend configuration,
with `ENV=development` (or `test`). The policy defaults to denied and is rejected
outside those local environments. Link possession grants no buyer identity guarantee;
anyone holding a forwarded link can view its public terms and make the first submission.
Seller routes still require the owning seller's verified session. Durable storage and
startup checks still apply; the policy does not enable an in-memory self-test fallback.

Use `npm run dev:backend`, which disables Uvicorn access logging to avoid recording
bearer URLs. Direct Uvicorn launches must also pass `--no-access-log`. Application
handlers do not log request bodies; public validation errors omit input values and
sanitize custom validator messages. Proxy and hosting logs require separate review
before any hosted use. This policy is for the private synthetic exercise only.

The [AC01–AC50 annex](../.scratch/phase-1-order-confirmation/acceptance.md) remains
normative. For each ID, record result, release revision, date, evidence link and
any deferred portion. The groups below assign evidence, not completion status.

| Cases | Required local evidence |
| --- | --- |
| AC01–AC03 | Real sessions plus negative token/verifier and two-shop isolation checks; synthetic same-TrxID independence |
| AC04–AC09 | Durable order/account terms, input validation, distinct contact/sender numbers and full manual-only browser flow |
| AC10 | Disabled AI controls and zero AI calls now; live extraction quality/failure behavior deferred to the later AI test |
| AC11 | Generated valid/invalid images; byte/pixel/request limits and foreign evidence rejection |
| AC12–AC21 | Synthetic receipt/claim arrival orders, mismatches, corrections, conflicts and payment single use in PostgreSQL |
| AC22–AC23 | Independent database actors contend; manual/automatic and cancellation/correction races serialize safely |
| AC24–AC30 | Seller-only decisions/corrections, immutable confirmed terms and correct remaining COD |
| AC31–AC38 | Controlled-time submission expiry, terminal states, replacement, uncertain retries and stale-version rejection |
| AC39 | Restart, startup misconfiguration and database outage; explicit failure or resolved durable commit, never memory success |
| AC40–AC43 | Controlled-time raw/structured retention, unresolved dependencies, deletion retry and used-payment replay protection |
| AC44 | Unconfigured public policy denies; enabled access enforces the approved link permissions |
| AC45–AC48 | Local mobile/keyboard browser journey, polling recovery, clipboard paste, CSV import and public/private projections |
| AC49–AC50 | Supported synthetic SMS and visible unsupported cases without Gemini; baseline routes and final root checks |

Additional security/lifecycle cases approved in this review:

- Initial submission is due within 48 hours; post-submission status access continues
  while retained and not revoked. New submissions and buyer corrections are blocked;
  valid same-operation retries resolve the original outcome without another write.
- Revocation rejects public reads and writes, including retry replay. Seller access,
  order lifecycle and payment allocation remain intact. A request racing revocation
  must have a coherent serialized outcome; no authorization may rely on stale state.
- Reissue invalidates the old link and preserves the same order, original deadline,
  terms and allocation. Audit it; same-key retries return the same result. It cannot
  revive terminal orders or reopen a completed initial submission.
- Replacement gives the old link only its predecessor's terminal status, unless
  access was revoked or retention ended. It cannot reveal the successor link.

## Completion and deferred evidence

Claim only **local synthetic self-test passed** when applicable local cases pass,
actual PostgreSQL cases execute, browser results are recorded and the final root
gate passes. No evidence is currently marked PASS. Attach the root result/log paths
and report skipped or failed cases explicitly; do not treat a skipped required case
as success. Update existing implementation tickets with paths, decisions and results.

Deferred evidence remains explicit: live Gemini extraction and provider terms,
representative consented payment SMS, hosted deployment/TLS/storage acceptance,
external backup/log purge behavior, real-data deletion policies and real-seller
benefit. Synthetic cleanup tests do not prove deletion from provider backups.
Account/shop deletion and unmatched real-receipt retention remain pre-real-data
gates under the parent plan. A future Drive store needs its own access, retention,
failure and recovery evaluation before adoption.

After local completion, define and review a separate Gemini test using synthetic
data. Hosted testing and any real-seller pilot remain later milestones; neither is
authorized or implied by passing this checklist.
