# 03: Connect a seller's Pathao account

**What to build:** Each seller can connect their own Pathao merchant account, choose an account-owned pickup store, and save delivery-service defaults through a secure settings workflow while ordinary order collection remains usable without a connection.

**Blocked by:** None (can start immediately).

**Status:** completed (local verification; live-provider acceptance unrun)

- [x] Review the owning SDK/provider sources for authentication, token lifecycle, supported environments, and store listing. Record verified contracts and limitations; do not treat community README claims as runtime proof. Choose a narrow adapter rather than spreading SDK calls across application features.
- [x] Deliver the full settings workflow with typed management contracts, migrations/storage, seller UI, connection status, pickup-store choices, and saved default service. Do not overload bKash/Nagad receiving-payment accounts.
- [x] Authenticate and scope every management operation to the current seller's shop. Validate that a selected store belongs to the selected merchant connection and environment; a caller-supplied store ID alone is not authority.
- [x] Encrypt merchant credentials and retained tokens with dedicated server-side key material independent of seller authentication, saved-link keys, and payment-reuse secrets. Missing or incompatible key material fails explicitly.
- [x] Credentials are write-only; responses provide masked connection metadata only. Logs, error messages, audit details, public responses, and client storage never contain passwords, client secrets, or bearer tokens.
- [x] Keep offline, sandbox, and production state clearly distinct. Production booking remains disabled. The offline adapter supports setup/store fixtures without credentials or outbound requests and is visibly identified as simulated.
- [x] Saving or replacing defaults cannot silently alter an existing reviewed attempt or accepted booking. Version connection/settings changes so later review and submission can bind to a definite connection revision.
- [x] Handle invalid credentials, unavailable stores/provider, session loss, and late responses as recoverable settings states with redacted errors. Sellers may continue creating buyer links and collecting orders while disconnected.
- [x] Verify API/PostgreSQL and settings component behavior for save/read/update, cross-shop denial, store ownership, secret protection, missing-key failure, environment separation, stale settings, and offline operation.
- [x] Run focused tests and root `npm run check` as the final gate. Record which auth/store facts were source-reviewed, simulated, or actually verified in sandbox; do not claim provider acceptance without an actual request.

## Implementation record — 2026-10-26

- Baseline for review: `4f1ae01a1559a21a119c319d0e0d780385cb5742`, current branch `main`. Pre-existing App/GLOSSARY and design/ticket files are excluded from this implementation commit, except this ticket itself.
- Agreed TDD seams: authenticated management HTTP API, disposable PostgreSQL, seller settings components; provider HTTP transport fixtures. Observed red/green cycles for offline setup, secret configuration, component setup and initial-outage recovery.
- Added `backend/app/{api,models}/pathao.py`, `services/pathao_{connections,provider,secrets}.py`, migration `0021_pathao_connections.sql`, API/PostgreSQL tests; registered routes/schema/config and dedicated example key. Added seller `PathaoSettings`, typed contracts and component tests in the accounts section.
- Decisions: append-only shop/environment revisions; final compare-and-append under shop lock; no transaction across HTTP; live membership validation before defaults save. No secret-bearing idempotency cache. Reload after ambiguous saves. Existing drafts/reviews/bookings are never mutated by settings.
- Dedicated Fernet encryption fails on absent/invalid/reused/incompatible keys. Credential/token values are write-only and absent from responses/logs. Tokens are operation-local and discarded; no refresh-token retention/cache. Re-authentication per lookup is a deliberate simplicity/rate-limit trade-off.
- Source review and operator/API details: `docs/pathao-account-contract.md`. Candidate SDK actual auth/store/transport/client sources reviewed through GitHub; synchronous transport, POST retries and upstream-error interpolation make direct adoption unsuitable. The async adapter keeps fixed hosts, TLS, bounded pagination/timeouts, no redirects/proxies/retries.
- Focused results: `npm run test:backend -- tests/test_pathao_connections.py` **12 passed**; disposable loopback `npm run test:backend -- tests/test_pathao_connections_postgres.py` **3 passed**; `npm run test:frontend -- src/features/seller/PathaoSettings.test.tsx` **4 passed**; root `npm run typecheck`, backend/frontend lint **PASS**.
- PostgreSQL evidence: all migrations applied to isolated schemas on a disposable loopback cluster, including restart reads, encrypted-at-rest assertions, concurrent writers, tenant isolation and rejection of defaults when credentials are replaced during a delayed store lookup. No Neon data/migrations were touched.
- Browser evidence: rendered the actual settings component with synthetic HTTP fixtures; connected offline, explicitly selected pickup, saved revision 2, switched to sandbox credential form, and verified recoverable initial outage. Screenshot: `.cache/pathao-settings-browser.png`. Temporary harness removed. This is component browser acceptance, not a real Clerk/provider or hosted journey; phone viewport/device testing is unrun.
- Remaining limits: no live Pathao request/merchant credentials used. Production-host discrepancy between SDK and mirrored merchant docs remains an acceptance prerequisite; production booking is disabled with no submission endpoint. Key rotation and superseded-credential erasure need operator work/ticket 10.
- Final action: commit the reviewed implementation on the current branch; repository pre-commit hook also reruns the full gate. Future provider acceptance belongs to tickets 09/12, and credential erasure to ticket 10.

## Standards review

Independent reviewer identified one documented-standard issue and one robustness improvement:
explicit frontend mutation payload interfaces were missing (`AGENTS.md` requires explicit payload
types), and the upstream size limit was checked after buffering the response. Both are resolved.
The client now declares connection/default request contracts and constrains service codes to 12/48;
the adapter reads bounded chunks, stops at 1 MiB, closes the stream and redacts failures. Two API
transport regression cases first reproduced full-body consumption, then passed with streaming.
No other actionable standards violations or baseline smells were reported.

## Spec review

Independent reviewer reported zero actionable specification defects. Shop ownership, active merchant
store validation, environment separation, dedicated credential encryption, immutable revisions,
session cleanup and late-response rejection were found consistent with the ticket. Live-provider
compatibility is explicitly unverified; production booking remains disabled. Review base was
`4f1ae01` with only staged implementation files included, excluding pre-existing checkout edits.

## Final gate record

The first root gate (`.cache/checks/check-9Bh7Nc/result.json`) completed backend tests with **542 passed,
1 failed**: the migration inventory still expected 20 files. Its exact count/contiguous-prefix assertions
now expect 21 migrations; focused `test_durable_postgres.py` then passed **4/4** with real PostgreSQL.
The gate was rerun after this correction; final result is recorded below when complete.

Final root `npm run check`: **PASS**, including tooling, lint, strict types, **543 backend tests**
(PostgreSQL enabled), frontend tests, production build and HTTP smoke. Evidence:
`.cache/checks/check-y9PkAh/result.json` and adjacent stage logs. No provider calls, live migrations,
physical-device acceptance or external bookings are claimed. Standards review: two findings resolved;
spec review: zero findings. Unrelated checkout edits remain outside the commit.
