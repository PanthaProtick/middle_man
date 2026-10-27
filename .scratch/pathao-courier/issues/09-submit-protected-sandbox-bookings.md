# 09: Submit protected bookings to Pathao's sandbox

**What to build:** The seller's existing protected submission and reconciliation workflow can use the actual Pathao sandbox, creating a synthetic delivery request and recording its consignment without enabling production pickup requests.

**Blocked by:** 07 — Resolve unknown booking outcomes; 08 — Handle changes after submission.

**Status:** implemented; actual sandbox acceptance BLOCKED (no account-owned credentials)

- [x] Audit owning sources and available runtime contracts for create-order payloads, monetary units/precision, location requirements, success/failure responses, consignment lookup, authentication/token handling, timeouts, logging, and automatic retry policy. Record concrete evidence and choose the community SDK only if its behavior is suitable; a narrow direct client is acceptable where verified.
- [x] Wire the real sandbox transport through the same external-courier adapter used by offline tests. Reuse durable attempts, snapshots, duplicate guards, error classification, and reconciliation; do not add an unprotected shortcut.
- [x] Explicitly select sandbox credentials, stores, catalogs, and references. Reject environment/account mismatches and keep production submission disabled on the server.
- [x] Configure bounded timeouts and no automatic replay of create-order POST requests. Do not block async application handling with synchronous SDK network calls, hold database transactions across the network, or assume merchant references guarantee provider idempotency.
- [x] Translate exact server-derived COD and validated recipient/parcel/service metadata. Reject unsupported precision or contract values rather than silently rounding, guessing, or substituting destinations.
- [x] Treat accepted-but-unpersisted or ambiguous responses as unknown and preserve the submission lock. Redact provider errors and avoid storing unnecessary raw personal data.
- [ ] **BLOCKED:** Verify actual sandbox access and an account-owned usable test store before any request. Use synthetic recipients/payment evidence only; do not silently switch to production if sandbox access is unavailable.
- [ ] **BLOCKED:** Complete an actual sandbox booking through the seller-facing workflow and record safe evidence of the request outcome and consignment association. Validate available consignment verification and credential/store/catalog behavior without overstating capabilities the provider does not expose.
- [x] Keep transport regression tests offline through the established boundary, covering definitive rejection, rate limiting, ambiguous failures, malformed responses, timeout, and recovered success. Do not claim simulated faults occurred inside Pathao.
- [x] Run focused tests and root `npm run check` as the final code gate. Report local, PostgreSQL, and actual sandbox results separately; missing access or an unsuccessful sandbox journey remains BLOCKED/FAIL, not a simulated PASS.

## Implementation record (2026-10-27)

### Audit evidence

- Sandbox host `https://courier-api-sandbox.pathao.com`, password grant at
  `/aladdin/api/v1/issue-token`, create order at `/aladdin/api/v1/orders`, and short
  order info at `/aladdin/api/v1/orders/{consignment_id}/info` are documented in the
  [merchant API mirror](https://hackmd.io/@saikat/HyX7Wa2eR). Production host is
  `https://api-hermes.pathao.com`. The mirror is documentation, not runtime proof.
- The [merchant SDK types/README](https://www.npmjs.com/package/pathao-merchant-sdk)
  corroborates response shape (`consignment_id`, `merchant_order_id`, `order_status`,
  `delivery_fee`), weight 0.5–10 kg, services 48/12, parcel type 2, and COD in taka.
- [Pathao's 2025 auto-address notice](https://pathao.com/bn/blog/api-merchant-auto-address-feature/)
  says newer create-order calls may omit city/zone/area and let Pathao derive them from
  the full address. This conflicts with the older mirror and is unresolved until live
  sandbox acceptance. The implementation keeps the explicitly reviewed, persisted
  destination IDs rather than guessing or discarding reviewed facts.
- Sender name/phone appear in the mirror's payload but are absent from current SDKs and
  the official auto-address curl; they are not sent. Pathao derives sender details from
  the selected store/account. Actual acceptance remains unverified.
- The Python SDK's HTTP layer uses synchronous requests with up to three retries,
  including POST, and a blocking backoff. It was **not** adopted. The implementation
  uses async HTTPX directly.
- Consignment short-info is documented and typed with consignment ID, merchant order
  ID, and status. No store ID or account ID is guaranteed, so lookup compares the store
  only when the response supplies it and does not claim account-wide proof beyond the
  authenticated account scope.
- COD precision is undocumented beyond taka examples. Non-whole-taka balances are
  rejected instead of rounded.

### Changed paths

- `backend/app/services/pathao_booking_transport.py`: narrow sandbox create-order,
  token, lookup, payload validation, response bounds, no retries/replay.
- `backend/app/services/pathao_provider.py`: sandbox dispatch at the existing adapter.
- `backend/app/services/pathao_connections.py`: reviewed-revision credential loading.
- `backend/app/services/courier_reservation.py`, `courier_review.py`,
  `courier_attempts.py`, `courier_reconciliation.py`,
  `backend/app/models/courier_submission.py`: sandbox selection, revision binding,
  setup-failure recording, lookup evidence.
- `frontend/src/features/seller/CourierReview.tsx` (+ test): sandbox-specific submit
  and result wording.
- `docs/pathao-submission-contract.md`, `docs/API_CONTRACTS.md`: sandbox transport,
  disabled production, case-insensitive consignment matching, and verification limits.
- `backend/tests/test_pathao_sandbox_booking.py`: exact payload, replay suppression,
  timeout→unknown→verified recovery, production disabled, definitive/rate-limit/
  ambiguous/malformed classification, lookup mismatches, revision mismatch.

### Verification

- Focused backend suites (submission, failures, review, reconciliation, reconciliation
  evidence, changed replay, post-submission changes, settings, sandbox): **80 passed,
  4 skipped** (PostgreSQL-only cases skipped in that local command).
- Root `npm run check`: **PASS**, result `.cache/checks/check-I7Wfoz/result.json`.
  Backend **503 passed, 168 skipped** (no disposable PostgreSQL in this run);
  frontend **204 passed**; lint, strict types, build, and HTTP smoke passed.
- PostgreSQL: **NOT RUN** in the final check; later ticket 12/acceptance must run the
  existing PostgreSQL suite where available.
- Actual Pathao sandbox booking and consignment association: **BLOCKED**. No
  account-owned sandbox credentials or usable test store exist in the environment.
  Publicly documented shared test credentials were not used, and no live request was
  attempted. This is not a PASS.

### Follow-up PostgreSQL verification (2026-10-27)

- Connected to the user-created local PostgreSQL 18 database `middle_man_test`
  using `BUYER_TEST_POSTGRES_URL`; isolated test schemas apply all migrations.
- Focused retention, courier submission, and courier reconciliation PostgreSQL
  suites: **28 passed, 1 failed**. Failure:
  `test_postgres_confirmed_noncreation_allows_retry` expects an identical replay
  response after a new booking attempt; actual replay returns the latest attempt.
- Full root `npm run check`: **FAIL**, result
  `.cache/checks/check-1c2HqV/result.json`. Backend **670 passed, 1 failed**, no
  skipped tests. Same replay failure; tooling, backend lint/types passed.
  Frontend and HTTP smoke stages were not run because the gate stopped.
- Actual sandbox access/booking remains BLOCKED. PostgreSQL execution is now
  available, but its failing regression must be resolved before claiming a pass.

### Replay assertion correction (2026-10-27)

- Root cause: the PostgreSQL test retained an obsolete exact-response replay
  assertion. The documented contract returns the current authorized review while
  retaining the original operation receipt. Application behavior was correct.
- Updated `backend/tests/test_courier_reconciliation_postgres.py` to assert the
  current successful attempt is visible, resubmission stays disabled, only two
  attempts and one resolution exist, and the stored receipt remains unchanged.
- Focused reconciliation and replay PostgreSQL suites: **16 passed**.
- Final root `npm run check`: **PASS**, result
  `.cache/checks/check-vxbSn7/result.json`. Backend **671 passed**, no skips;
  frontend tests, lint, strict types, build, and HTTP smoke passed.
- Actual sandbox acceptance remains BLOCKED; local PostgreSQL does not establish
  live Pathao or browser acceptance.
