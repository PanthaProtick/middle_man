# 03: Submit buyer details and see pending status

**What to build:** A buyer completes a mobile manual form and sees a durable pending acknowledgement without needing an account, screenshot or AI.

**Blocked by:** [02: Create an order and retrieve its buyer link](02-create-order-links.md)

**Status:** completed

## Acceptance criteria

- [x] Display only public shop/order/payment instructions, copy receiving number, and immutable terms. Require reviewed readable address, name, contact, full payment sender, provider, TrxID and claimed amount.
- [x] Validate contact independently from sender; support specified Bangla-digit/local/+880 canonicalization while preserving raw reviewed values. Trim TrxID boundaries without undocumented normalization.
- [x] Atomically accept first completed submission strictly before server expiry; at/after deadline return expired. Initial submission is single-use, idempotent and persists buyer/claim revisions, server timestamps and pending status.
- [x] Completed submissions never expire automatically. Opening/drafting the form does not count; show status instead of a buyer editing/resubmission loop after success.
- [x] Preserve entered values on recoverable failures, use the same key/payload after unknown outcomes, and never treat a local optimistic record as saved. Include Bangla/English mobile labels and accessible validation.
- [x] Keep live public operations disabled until buyer-access/projection policy is settled; use explicit non-live permission adapters for demonstrations. Token possession never permits seller edits.
- [x] Record minimal durable aggregate link-open/submission measurements without raw personal data; distinguish repeat/bot opens and unknown commits from unique buyers, and do not claim identity proof.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC05, AC07, AC08, AC09, AC28, AC31, AC32, AC33, AC37, AC38, AC39, AC44, AC45, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

Completion reverified on 2026-10-23 after resolving the latest-commit review.

- **Root gate: PASS** — `npm run check`, all eight stages. Artifact:
  `.cache/checks/check-ckA6hw/result.json`. Backend: **74 passed**; frontend:
  **33 passed**. This invocation explicitly set `BUYER_TEST_POSTGRES_URL` to the
  disposable loopback PostgreSQL instance; ordinary credential-free runs skip
  the opt-in PostgreSQL cases instead of claiming they passed.
- **Disposable PostgreSQL: PASS** — **13 tests** in
  `backend/tests/test_buyer_postgres_transactions.py` and
  `backend/tests/test_buyer_postgres_boundaries.py`. Actual SQL migrations
  `0001` through `0004` were applied in isolated schemas. Independent request
  connections contended on a real row lock. Tests cover different/same-key
  submissions, expiry while waiting, strictly before/at/after expiry,
  public/seller expiry-read races, replay-record failure rollback, unique
  revision enforcement, database outages, persisted replay after clearing memory
  and reconnecting, safe large amounts, and repeat/bot measurement limitations.
  Focused output: `.cache/buyer-acceptance/postgres.log`.
- **Actual browser with production frontend and disposable PostgreSQL: PASS** —
  tested at a 390 x 844 mobile viewport with synthetic records and injected
  non-live permission. Exercised loading, accessible empty-field validation,
  separate Bangla contact and +880 sender input, manual submission without
  AI/upload/account, a response lost after commit plus failed reconciliation
  read, locked/preserved input, same-attempt retry to pending acknowledgement,
  reload, and a recoverable initial-read outage followed by Retry. The copy button
  showed Copied; component tests separately assert the exact number passed to
  the clipboard API. Native clipboard contents were not independently verified.
- **Real API and PostgreSQL process restarts: PASS** — the browser reloaded the
  same pending acknowledgement after both were restarted. Database assertions
  confirm one revision, one replay outcome, one committed-submission measurement,
  one version increment, a server timestamp and boundary-only TrxID trimming.
  Evidence: `.cache/buyer-acceptance/database.json`,
  `.cache/buyer-acceptance/browser.md`, and
  `.cache/buyer-acceptance/mobile-pending.jpg`.
- **Configured live identity/provider, hosted migration/deployment or real-data
  pilot: NOT RUN**. Live public permission remains denied. The synthetic harness
  does not establish production authorization, provider readiness or launch approval.

### Review resolutions and changed paths

- `backend/app/services/buyer_service.py`: lock the aggregate before replay/state
  checks; sample server time after lock acquisition; atomically commit revision,
  pending state, measurements and replay outcome. Public and seller expiry reads
  use the same row-lock discipline in `order_service.py`; seller projections now
  retain the saved buyer revision. Expiry cannot overwrite an accepted submission.
- `backend/app/core/idempotency.py`: support staging a replay record in the caller's
  transaction; bound long persisted keys with a deterministic digest. Buyer scopes
  store token digests rather than raw portal tokens.
- `backend/app/models/entities.py` and
  `backend/migrations/0004_buyer_submission_integrity.sql`: enforce unique
  order/revision pairs and use BIGINT for safe integer money values. Existing
  migrations remain intact. Duplicate historical revisions cause migration failure
  for explicit investigation; the migration never silently discards them.
- `backend/app/api/public_orders.py` and `core/public_gate.py`: remove request clock
  overrides, inject clocks for tests, require a bounded mutation key, return explicit
  database unavailability, and default-deny public access. The separately injected
  synthetic adapter rejects live environment labels and configured database/identity
  credentials. Requests cannot grant themselves permission.
- `backend/app/models/buyer.py`: reject unknown/internal write fields, validate
  contact and sender independently, preserve reviewed phone text, require strict
  safe integer claims and qualified timestamps, and reject unbound screenshot
  references until the separate upload slice exists.
- `backend/app/services/buyer_projection.py`, `buyer_revision.py`, and
  `buyer_measurements.py`: share the public allowlist and revision construction;
  distinguish observed repeats/advisory bot opens. Submitted status polls are not
  counted as opens; committed submissions are counted once. These are request/link
  aggregates, never unique-buyer or identity-proof measurements. Undetected bots,
  shared links and changed user agents remain measurement limitations.
- `frontend/src/features/buyer/useBuyerSubmission.ts`, `BuyerPortal.tsx`,
  `BuyerSubmissionForm.tsx`, `PaymentClaimFields.tsx`, and `api.ts`: freeze the
  original attempt after an unknown outcome, reconcile server status, preserve
  editable input after definitive validation failure, show linked field errors,
  convert decimal money exactly and distinguish policy denial from retryable
  database outages. A successful submission removes the form. Existing polling is
  not acceptance of ticket 16's full visibility/backoff/lifecycle requirements.
- `backend/app/main.py`, `frontend/index.html`, and `scripts/workspace.mjs`: apply
  no-store/no-referrer protection to public API errors as well as successes, set
  page referrer policy, and disable raw request-path access logs in the supplied
  development launchers. Hosting/proxy logging/cache policy remains a launch gate.
- Regression coverage is in `backend/tests/test_buyer_boundaries.py`,
  `test_buyer_models.py`, `test_public_order_routes.py`, the PostgreSQL tests above,
  and buyer `BuyerPortal.test.tsx`, `BuyerRetry.test.tsx`, and `api.test.ts`.
  `backend/tests/buyer_postgres_support.py` provides loopback-only isolated schemas.

### Reproduce local acceptance

Set `BUYER_TEST_POSTGRES_URL` to a disposable, loopback-only PostgreSQL target, then
run `npm run test:backend -- tests/test_buyer_postgres_transactions.py tests/test_buyer_postgres_boundaries.py`.
The fixture applies migrations into fresh schemas and removes only those schemas.
Do not point it at a shared database. Root checks stay credential-free by default.

For controlled browser acceptance, build with `npm run build`, then launch
`backend/.venv/Scripts/python.exe -X utf8 backend/tests/buyer_browser_demo.py` from
this Windows workspace. The harness clears provider inputs, injects synthetic
permission, creates an isolated schema and serves the built frontend on loopback
port 8013. `.cache/buyer-browser.json` contains the synthetic portal metadata.
`--resume` reuses that schema for restart verification. The `/__test__/faults`
controls exist only in this test launcher, never in the application entry point.
The temporary API and PostgreSQL processes were stopped after verification.

No remaining implementation action for ticket 03. Shared live launch gates and
later tickets remain separate work.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.
