# 19: Delete eligible personal records without releasing payments

**What to build:** Remove eligible completed personal records while retaining unresolved dependencies and minimal consumed-payment protection.

**Blocked by:** 15: Verify durable receipt-to-confirmation behavior; 18: Run raw-evidence cleanup with safe retries.

**Status:** completed

## Acceptance criteria

- [x] Controlled-time tests enforce 12 calendar months for completed records and preserve structured evidence needed by unresolved orders.
- [x] Personal-data deletion leaves minimal replay markers: the consumed TrxID cannot be resubmitted/reimported into a reusable receipt.
- [x] Failures/retries report accurate partial/overdue outcomes, and no test claims purge from backups or solves deferred real-data account-deletion policy.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing structured retention, unresolved-order dependencies, marker binding and seller retention reporting.

## Verification target

Execute existing PostgreSQL structured-retention/used-marker tests and add boundary/dependency regressions only where needed; verify status through the existing seller surface.

Coverage: AC41–AC43. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

New real-data account/shop deletion policy and permanent retention of unnecessary personal fields.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

Published from the user-approved 22-ticket breakdown on 2026-10-24.

### 2026-10-25 verification

- Starting commit: `ef888fe5ab2d786de59fd2b2bbc01987cd871d27`, branch `main`, clean checkout.
- Existing structured cleanup already implements the requested behavior; no production changes were needed.
- Added `backend/tests/test_personal_retention_postgres.py`: seller HTTP cleanup preserves records one microsecond before the anniversary, removes at the exact anniversary (leap-day clamp and a leap-year interval), and reports one successful removal alongside one durable SQL failure, followed by successful retry and no-op replay.
- Test setup correction: the shared order factory intentionally replays a fixed idempotency key. The partial-failure scenario therefore creates its second order with a distinct key. The initial failure was a fixture mistake, not a production defect.
- Existing PostgreSQL assertions retained: unresolved claims preserve shared structured receipts until their own deadline; manual and SMS reimports of consumed TrxIDs remain blocked after deletion and a fresh session; missing/rotated marker keys fail closed; concurrent cleanup removes once; storage deletion and replay-cache redaction are checked.
- Disposable target confirmed by `.cache/resolution-pg/postmaster.pid`: repository-local cluster on loopback port 55447. Tests migrate and drop unique `buyer_test_*` schemas, without using the persistent manual self-test dataset or live credentials.
- Focused backend command with `BUYER_TEST_POSTGRES_URL=postgresql://postgres@127.0.0.1:55447/postgres`: `npm run test:backend -- tests/test_personal_retention_postgres.py tests/test_structured_retention_postgres.py tests/test_structured_retention.py tests/test_payment_marker_protection.py`: **31 passed**, 3.95s, no skips.
- `npm run test:frontend -- src/features/seller/StructuredRetentionPanel.test.tsx`: **2 passed** (component tests for loading, failure/retry, overdue and removal reporting).
- `npm run typecheck`: **PASS**, Python 95 source files and TypeScript.
- Code review against the starting commit (staged diff): independent Standards **0 findings**, Spec **0 findings**.
- Initial root gate `.cache/checks/check-qdzxIx/result.json`: **FAIL** at backend tests, 462 passed / 32 setup errors because the shared Windows pytest temporary directory was inaccessible. No production failure diagnosed.
- Final root gate `npm run check`: **PASS**, all eight stages, `.cache/checks/check-05Jepc/result.json`. PostgreSQL enabled; `TMP` and `TEMP` set to `E:/middle_man/.cache/ticket-19-temp` for this invocation to avoid the shared temporary-directory permission failure. Backend **494 passed** (44.84s); tooling, backend lint/types, frontend lint/tests/build, HTTP smoke all passed. No test filtering or skips in the backend suite.
- Next action: dependent browser/acceptance tickets 20–22 retain responsibility for real-session and combined-candidate evidence. Ticket 19 is complete for local synthetic retention acceptance.
- Limits: synthetic local PostgreSQL and HTTP/component evidence only; no browser/real Clerk/Neon acceptance, backup/log/provider purge verification, or real-data account/shop deletion policy claimed. Those remain deferred or owned by tickets 20–22 and the parent launch gates.
