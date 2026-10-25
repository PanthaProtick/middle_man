# 20: Record the real-session manual browser journey

**What to build:** Record an actual local manual workflow with two Clerk test identities, the dedicated Neon development database and generated evidence.

**Blocked by:** 05: Handle session loss and reject foreign-shop access; 13: Persist and privately retrieve screenshots; 15: Verify durable receipt-to-confirmation behavior.

**Status:** completed — real-session browser journey recorded; final gate and evidence review passed

The current evidence reconciliation below supersedes earlier pending/blocked notes. Initial startup/target blockers were resolved with user-confirmed development migrations and persistent secrets. Historical observations remain for provenance.

## Acceptance criteria

- [x] Record revision, local URLs, sanitized target identity and dated observations for setup, receiving account, fixed order, link, manual buyer form, optional image and confirmation.
- [x] Demonstrate two-shop separation and real sessions, and verify order/image persistence after restart with AI disabled.
- [x] Preserve privacy-safe observations and mark failures/unrun portions explicitly; intercepted HTTP, fake tokens and direct database probes do not substitute for this journey.
- [x] Record focused verification results and remaining gaps; for code/tooling changes, run the required final root verification gate and record its result.

## Bounded context

Read the shared ticket index and only the relevant specification sections first.
Then trace: Existing setup/order/buyer/evidence/status UI and approved local browser acceptance checklist; no test-only public/auth overrides.

## Verification target

Use actual local browser operations and application requests against intended providers. This is an evidence ticket; route any substantial discovered implementation fix back to its owning ticket.

Coverage: Browser evidence for AC01–AC09, AC12, AC16, AC39, AC48. Retain meaningful existing assertions; completion requires actual results, not just new tests.

## Keep outside this ticket

Hosted browser acceptance, real order data and live Gemini.

## Context-safe handoff

Reserve context for diagnosis, focused verification and the final gate. Before a reset or if the next step needs a substantially wider investigation, update this ticket with decisions, changed paths, exact checks/results, reproducer, uncertainty and next action. Do not broaden silently or claim completion when required evidence is missing. Consult the shared index for scope and evidence rules.

## Comments

### Current evidence reconciliation — 2026-10-25

Final unfiltered `npm run check`: **PASS**, `.cache/checks/check-udrfny/result.json`, finished `2026-10-25T11:55:03.403Z`. Tooling, backend lint/types, **506 backend tests (0 skipped)**, frontend lint, **31 files / 150 frontend tests**, production build and HTTP smoke all passed. Ran with workspace TEMP/TMP, process-local offline test policy and disposable loopback PostgreSQL target as documented below. Independent code-review skill: Standards 0 outstanding / Spec 0 outstanding after correcting stale evidence-only/pending-report handoff text. All Ticket20 acceptance criteria are complete within their recorded boundaries; Ticket21 has not started.

Candidate application revision `1c8b80d`; localhost frontend 5173/backend 8000; owner-confirmed dedicated Neon development target, sanitized fingerprints recorded below; two real owner-controlled Clerk identities. All payment/buyer/image data is synthetic. This continuation changes evidence records and repairs the existing recovery test's timestamp fixture; application behavior is unchanged.

Owner returned `TICKET20_REVERSE_REPORT` timestamp `2026-10-25T11:48:25.817Z` (17:48:25.817 BST): **19/19 PASS**. B owner image retrieval 200; six foreign A private reads each 404 matching nonexistent-resource errors; B order/receipt/account lists exclude A targets; all eight foreign mutations each 404 matching nonexistent-resource errors; B orders unchanged. Together with A's 11/11 read and 17/17 write/validation reports, actual direct requests now cover both directions. A has no image fixture; A→B image denial and B owning-image success cover the existing screenshot. Reports are owner-run real browser evidence, not agent-captured network traces.

| Coverage | Dated evidence and boundary |
| --- | --- |
| AC01–AC02 | Real sign-out, A/B identity changes, owner device revocation clearing private UI, expired genuinely issued JWT 401 and fresh-token 200, bidirectional direct private read/mutation/list checks and observed own export scope. Offline verifier-unavailable/late-response and retention tests remain supplementary; no live Clerk outage or aged Neon retention operation claimed. |
| AC03 | Same SYNTH20C01 independently allocated in B and A; both confirmations remained valid. |
| AC04–AC06 | Real order/reload/process restart and fixed 48-hour terms; eight invalid input requests return 422 with unchanged order list; B account relabel/deactivation preserves existing destination and prevents new selection. |
| AC07–AC09 | Different buyer contact/payment sender; Bangla and +880 sender normalization; complete manual buyer flow without required image/OTP/AI; generated optional image uploaded and privately retrieved. Effective self-test policy and public UI disable assistance; focused provider guards pass. No measured provider usage telemetry or live Gemini test claimed. |
| AC12, AC16 | B C receipt-first and D claim-first both automatically confirmed once, v3, accepted 100/COD 800; A E independently confirmed. A original explicit manual exception is recorded separately. |
| AC39 | Actual Neon-backed process restarts preserve order/confirmation/private image. Fresh seven-case loopback PostgreSQL contention/outage execution supplements this with transaction rollback, explicit 503, original-key recovery and memory-wipe durability. Failure injection is confined to disposable schemas as required by the spec; a live Neon network interruption during browser acceptance was not performed. |
| AC48 | Observed pending/confirmed public projections omit buyer personal/payment evidence/internal review verdict; foreign private image denied, owner image accessible; actual A CSV contains only own two rows. |

Ticket 21 owns remaining browser revoke/reissue/replacement recovery, storage-failure UI, mobile/offline/keyboard, actual clipboard paste and CSV import cases. Ticket 22 owns final cross-ticket acceptance reconciliation; this record does not declare the entire local self-test or all variants in owning tickets complete. Retention eligibility is exercised under controlled clocks in isolated tests, not by destructively aging this persistent dataset. Unexpired revoked-JWT immediate invalidation is not promised by the stateless verifier; real client revocation and actual expiry were separately observed. No hosted, real-money or live-AI readiness is inferred.

Final gate attempt `.cache/checks/check-qNaZwL/result.json`: FAIL at backend tests, 473 passed / 32 setup errors caused by WinError 5 accessing the system pytest temp directory; no failed behavioral assertions. Tooling/lint/types passed; later stages not run. Retrying the unfiltered root gate with process-local TEMP/TMP pointing to `.cache/ticket20-verification-temp`, SELF_TEST_MODE=false for offline test setup, and the disposable loopback PostgreSQL URL; running provider process configuration is unchanged.

Second root attempt `.cache/checks/check-knqBdX/result.json`: FAIL, 504 passed / 1 failed; temp setup repaired. Existing Ticket16 recovery fixture reused Order1 creation+10ms for Order2's independent receipt, sometimes predating Order2. Focused unchanged rerun passed once (0.76s), then controlled equal/one-second creation-gap cases reproduced 1 PASS / 1 FAIL at the same confirmation assertion. Corrected `backend/tests/test_payment_recovery_journey_postgres.py` so each receipt uses its own order's inclusive creation boundary. Both controlled cases now PASS (1.82s); all conflict/resolution/correction/confirmation/idempotency assertions preserved. No production clock or matching rule changed. This small owning-test repair is required to obtain a meaningful final gate, not evidence of an application matching defect.

Actual B Download filtered CSV completed after reverse checks: saved `.cache/ticket20-evidence/shop-b-export.csv`, three B rows including B image order, zero A original/E UUIDs. Combined with earlier A actual export, both observed exports are scoped. CSV spreadsheet import/formula safety remains Ticket21. Browser B still has three orders (two confirmed, one pending TIME_UNCLEAR), three payments, and its receiving account remains inactive.

### 2026-10-25 owner-run mutation, validation and real expiry checks — PASS

Owner returned `TICKET20_WRITE_REPORT` at `2026-10-25T11:44:35.078Z` (17:44:35.078 BST): **17/17 PASS** using the real Shop A browser session. Foreign B buyer correction, payment decision, replacement, account update, receipt correction, receipt resolution, link revoke and link reissue each returned 404 with the same error envelope as a nonexistent resource. Valid request contracts were used; 422 was not accepted as proof of authorization. Negative/zero total, negative/zero advance, unsafe integer money, advance above total, empty account ID and blank product each returned 422. Before/after own-order responses were unchanged (200).

Owner returned `TICKET20_EXPIRY_REPORT` at `2026-10-25T11:45:19.321Z` (17:45:19.321 BST): **PASS**. The genuinely issued token stayed only in the browser closure until its actual expiry plus five seconds; replay returned 401/UNAUTHORIZED. A freshly acquired Clerk token returned 200. The console's 401 diagnostic is the expected denial, not a failed check. This proves expired-token rejection and valid-session recovery; earlier real device revocation separately proved client clearing. It does not assert instantaneous rejection of an already-issued, unexpired token after device revocation; the current verifier checks signature/claims without a per-request session-status lookup.

Prepared syntax-checked ignored `console-reverse-check.js` for B→A direct reads, lists and eight mutations, with own B image 200 control. Owner asked to sign in as B and return `TICKET20_REVERSE_REPORT`; **pending**, not yet a pass. A owns no screenshot, so no nonexistent A-image fixture is presented as a positive control. Reverse targets came from a read-only, fingerprint-guarded synthetic UUID lookup; no credential/private content output, no data changes, and lookup itself is not acceptance evidence. Temporary lookup script removed.

### 2026-10-25 resumed gap closure after third compaction

- Rechecked checkout and the authoritative disposable handoff; preserved the prior owner-returned 11/11 direct read report, including foreign image denial. Opened a fresh actual browser tab at localhost:5173; real Shop A session remains active, with the same two confirmed orders/two payments/one account.
- Prepared ignored `.cache/ticket20-evidence/console-write-check.js` from the current route/Pydantic contracts. `node --check` PASS. Owner action requested: execute in the real Shop A console. Eight foreign mutation routes compare 404/error envelopes to nonexistent resources; eight invalid order inputs require 422; own-order list must remain unchanged. A subsequent bounded wait replays the genuinely issued token after expiry and compares with fresh-token access. **Reports pending; no mutation/expiry pass claimed.** Tokens remain inside the browser closure. No retention cleanup or destructive provider fault injection is included.
- Fresh supplementary execution: process-local `SELF_TEST_MODE=false`, `BUYER_TEST_POSTGRES_URL=postgresql://postgres@127.0.0.1:55447/postgres`; `npm run test:backend -- tests/test_payment_outages_postgres.py tests/test_payment_contention_postgres.py tests/test_shop_isolation.py tests/test_ai_policy.py tests/test_payment_extraction.py`: **27 passed, 0 skipped, 4.30 seconds**. Seven outage/contention cases use disposable random loopback PostgreSQL schemas, not persistent Neon. Outage trigger causes transactional rollback, explicit DATABASE_UNAVAILABLE, then original-key recovery. Restart test clears memory stores; actual process restart on Neon was separately observed earlier. Isolation tests use locally signed verifier fixtures; AI tests assert provider guards, not live-provider usage telemetry.
- Scope reconciliation: spec explicitly assigns destructive contention/outage fixtures to a disposable database. This rerun supports AC39 together with earlier real process restart; it does not establish a real Neon network failure during browser acceptance. Effective AI-disabled policy, manual browser flows and provider guard tests support disabled-mode behavior; measured external provider call telemetry remains uncollected. Do not silently turn either limitation into a new live-provider/destructive test requirement or claim it was observed.

Published from the user-approved 22-ticket breakdown on 2026-10-24. Implementation has not started.

### 2026-10-25 attempted local browser acceptance

Candidate: `b9ac24c0dc1e94106d6bcd0d5c39f57c4834d3dd`; checkout initially clean.
Evidence-only update; no application, configuration or schema changes.
Observations dated 2026-10-25 Asia/Dhaka (host log timezone is not acceptance time).

| Step | Result and actual observation |
| --- | --- |
| Baseline launch | `npm run dev:backend` started at `http://127.0.0.1:8000` but logged `durable_storage=False`. This launch does not qualify for the self-test. |
| Required durable launch | With process-local `SELF_TEST_MODE=true` and `PUBLIC_BUYER_ACCESS_POLICY=self_test_link_possession`, `npm run dev:backend` logged `durable_storage=True`, then failed startup: `Database connection failed: connect() got an unexpected keyword argument 'sslmode'`. No durable journey was possible. |
| Browser setup | `npm run dev:frontend` served `http://localhost:5173/`. Actual in-app browser navigation rendered the workspace, a disabled `Sign in` button, `Seller sign-in is unavailable. Configure Clerk to connect your shop.`, and `Session verification is unavailable. Please retry.` These are observed UI messages, not proof that a key is missing or invalid. Vite subsequently logged that Clerk loaded development keys. |
| Target and identities | Dedicated Neon target identity NOT VERIFIED; no hostname/database identifier or credentials inspected or recorded. Neither owner-controlled Clerk identity authenticated in this attempt. Do not infer that the configured target is safe for migration. |
| Receiving account, fixed order, link | NOT RUN: setup blocked. |
| Manual buyer form, distinct sender/contact, optional generated image | NOT RUN: no eligible durable order/link created. |
| Receipt arrival, confirmation, remaining COD | NOT RUN. |
| Two-shop isolation, sign-out/expiry/identity switch | NOT RUN with real sessions. Prior offline permission tests do not substitute. |
| Order/image persistence after restart | NOT RUN against the intended Neon target. |
| AI disabled | NOT VERIFIED end to end. The attempted self-test launch sets the mode that disables AI, but startup failure prevents browser proof or a zero-call observation. |

Reproducer and owning follow-ups:

- Ticket 01 storage configuration: trace `backend/app/core/config.py:effective_database_url` and `backend/app/core/database.py` engine construction. PG-field URL construction emits `sslmode`, while engine construction passes the URL to the asyncpg dialect without translating that parameter. The actual startup error establishes driver argument incompatibility; it does not establish database connectivity or schema readiness. Repair and regression coverage belong to Ticket 01, not this evidence ticket. Do not weaken TLS or use memory fallback.
- Ticket 04 sign-in: investigate the displayed unavailable state with the existing development-key setup after the durable backend is operational; the observation alone does not diagnose Clerk credentials. Do not introduce fake tokens or test-only auth overrides.
- After those fixes, confirm the sanitized dedicated development target and two owner-controlled test identities, then rerun this entire browser journey with generated evidence and AI disabled. Apply no migrations before target confirmation.

Coverage: AC01–AC09, AC12, AC16, AC39 and AC48 remain unverified by this journey. All acceptance checkboxes above remain open. No provider data was intentionally created or changed; no database probes, intercepted HTTP or synthetic auth were used as acceptance evidence. All three owned development command sessions were stopped after the attempt.

Verification: actual backend startup attempts and browser navigation as recorded above. No focused automated tests or typecheck run: no code/tooling changed. The repository pre-commit hook runs the full root gate for this record commit; its result is reported separately. Code review checks evidence accuracy and scope; a clean review cannot complete the blocked journey.

### 2026-10-25 authorized development migrations

User confirmed the dedicated development target and explicitly requested migration execution. Applied reviewed migrations 0001–0018 in a single psycopg transaction after an advisory lock and an empty-public-schema guard. All 18 committed; post-migration inventory contains 20 application tables. No reset or data deletion performed. Sanitized timestamp, filenames, SHA-256 checksums and table inventory: `.cache/ticket20-migration-result.json`.

Retried `npm run dev:backend` with process-local `SELF_TEST_MODE=true` and `PUBLIC_BUYER_ACCESS_POLICY=self_test_link_possession`. Database connection/schema readiness passed. Startup then failed with `LINK_ENCRYPTION_UNAVAILABLE`: `ORDER_LINK_ENCRYPTION_KEY` missing. Log: `.cache/ticket20-durable-startup.log`. Owned server session stopped. Encryption and later marker/evidence readiness remain incomplete; browser acceptance remains open. No secret generated, replaced or bypassed. Next action: configure a persistent development order-link encryption key, then retry startup and the real-session journey. This migration evidence does not complete any browser acceptance checkbox.

### Updated-key startup retry

After the user configured ORDER_LINK_ENCRYPTION_KEY and requested continuation, durable startup passed database and order-link encryption readiness. It then failed payment-marker readiness: `PAYMENT_MARKER_SECRET is missing or empty`. No secrets were displayed or changed. Owned backend process stopped; browser journey remains unrun. Configure a separate persistent random PAYMENT_MARKER_SECRET in backend/.env, then retry. Log: `.cache/ticket20-durable-startup.log`.

### 2026-10-25 full durable startup passed

Payment-marker configuration check returned configured without exposing its value. Retried backend with SELF_TEST_MODE=true and PUBLIC_BUYER_ACCESS_POLICY=self_test_link_possession. Actual startup completed successfully: database/schema, order-link encryption, payment-marker bindings and durable local evidence storage passed readiness. Log: `.cache/ticket20-durable-startup.log`. Backend left running at http://127.0.0.1:8000 (owned exec session 89459). This is startup evidence; real Clerk identities and browser journey remain unverified.

### 2026-10-25 browser retry after durable readiness

Frontend started at http://localhost:5173/ (owned session 19858); backend remains session 89459. Actual browser rendered Loading seller sign-in, then enabled Sign in and Connected status. Clicking Sign in opened real Clerk Sign in to MiddleMan dialog with email/Google and Development mode. No active Clerk session exists in this browser. Paused for owner to authenticate the first owner-controlled test identity; no credentials entered, no fake auth, no shop/order created. Tab retained for handoff. Durable startup success is separate from remaining browser acceptance.

### 2026-10-25 real-session shop/order browser evidence

Owner manually authenticated first real Clerk test identity. Actual browser showed signed-in shop setup; created Phase 1 Synthetic Shop A, active bKash receiving account 01700000001 labelled Synthetic receiving account A, and SYNTHETIC SELF-TEST — blue notebook. Observed Awaiting Buyer; total BDT 1,000, advance BDT 200, expected COD BDT 800, snapshotted receiving destination. UI displayed created 25 Oct 2026 04:07 pm BST and deadline 27 Oct 2026 04:07 pm BST. Copy Link showed Copied. No real payment performed.

Attempt to open the clipboard buyer URL was rejected by browser security policy: invalid URL; network-egress authority not granted. Did not retry through another surface or bypass. Seller tab preserved. Next action: owner manually opens the generated buyer link and reports ready; then resume buyer submission. Buyer submission/receipt/confirmation, second identity separation and restart persistence remain unverified. No buyer token or Clerk identity recorded here.

### 2026-10-25 manual buyer, receipt and restart journey

Actual public browser page displayed fixed 1000/200/800 BDT terms and AI assistance unavailable/manual entry. Submitted Synthetic Buyer A, synthetic address, distinct contact 01800000002 and sender 01900000003, TrxID SYNTH20A01, BDT 200, without image or OTP. Observed Pending Seller Review acknowledgement ACK-E0E926F5; authenticated seller desk showed Pending Verification and buyer details.

Recorded synthetic seller receipt SYNTH20A01, BDT 200, matching account/sender. Attempted occurrence input 2026-10-25T16:08 using browser date field; receipt preview subsequently showed Unknown and TIME_UNCLEAR. Automatic confirmation NOT proven. Explicitly accepted the exception with audited synthetic-only reason. Browser showed Confirmed, Manual allocation, accepted BDT 200, actual COD BDT 800, version 3 and decision history. No actual money transferred.

Stopped backend session 89459 and restarted self-test backend (session 7833; log .cache/ticket20-restart.log). Reloaded authenticated seller desk: same shop/account, one receipt, one Confirmed order and actual COD BDT 800 survived restart. Opened known actual portal URL: public Order Confirmed with accepted advance BDT 200 and remaining COD BDT 800. Then signed out: private seller desk cleared and sign-in prompt appeared. Opened Clerk dialog for second identity; owner action required to sign in with a distinct identity. No credentials recorded.

Remaining: second-shop/foreign-shop tests, expired session, generated-image upload/private retrieval/persistence, automatic receipt path and unknown occurrence-time diagnosis, sanitized target metadata and zero-AI-call evidence. No application code changed; no automated gate rerun for browser-only evidence. Earlier clipboard result was empty despite Copied UI; actual link was obtained from visible Open Portal, never invented. Original full acceptance remains open. Frontend session 19858 and backend 7833 left running.

### 2026-10-25 second identity and generated-image journey

Owner authenticated distinct second identity. Browser showed fresh Shop Setup rather than Shop A. Created Phase 1 Synthetic Shop B: initially zero orders, payments and accounts. Opened Shop A public link (intended public terms/status visible), then its actual Seller Access: Correct Buyer Information link under B session. Private correction view returned Order not found; no Shop A buyer/private fields appeared, and B counts remained zero. This establishes observed foreign correction rejection and desk separation, not every private endpoint.

Created B account 01700000004, Synthetic receiving account B, and SYNTHETIC SELF-TEST — image fixture B (total 1500, advance 300, expected COD 1200). Generated valid 320x160 solid-colour PNG fixture with synthetic-only metadata using standard-library PNG encoding; not a payment-provider screenshot. Fixture and generator in ignored .cache/ticket20-evidence/. Uploaded via actual browser file chooser; UI showed synthetic-upload.png. Submitted Synthetic Buyer B, contact 01800000005, sender 01900000006, synthetic address, SYNTH20B01 and BDT 300 without AI or OTP. Observed Pending Seller Review ACK-2E48472F. Authenticated B Inspect showed Payment Screenshot Evidence and rendered the fixture.

Stopped backend 7833; restarted self-test backend session 66147 (log .cache/ticket20-image-restart.log). Reloaded browser, reopened B order: pending order, buyer details and private image survived process restart; new blob URL loaded from backend. Screenshots .cache/ticket20-evidence/shop-b-private-evidence.png and shop-b-evidence-after-restart.png contain only synthetic test data. Browser tab 6 retained, B remains logged in. Frontend session 19858 remains running. No code changed, no automated gates rerun. Browser evidence does not prove direct foreign screenshot endpoint denial, actual session expiry, zero live-AI requests, automatic receipt confirmation or mobile/keyboard coverage. Those remain open; full ticket acceptance is not claimed.

### 2026-10-25 remaining-verification pass (17:15–17:20 BST)

Revision: `1c8b80d`; frontend `http://localhost:5173/`, backend `http://127.0.0.1:8000`. Existing real Clerk Shop B session remained authenticated. Target fingerprint from internal Settings (no URL/credential output): Neon host SHA-256 prefix `ecd013abe3562868`, database SHA-256 prefix `693fe5919fc229a2`. This fingerprints the previously user-confirmed dedicated development target; it does not independently attest provider ownership. Configuration loaded from backend working directory now reports SELF_TEST_MODE=true, self_test_link_possession policy and ai_enabled=false. Disposable inspection script removed.

- Existing B manual receipt SYNTH20B01 now recorded at 16:18 BST using actual keyboard date changes. Inbox preserved occurrence time; order remained TIME_UNCLEAR. This reason also covers times outside creation-to-claim interval, so it does not establish a missing-time defect. A minute-rounded value can precede creation seconds. No existing allocated receipt was modified.
- Fresh C order: total 900 / advance 100 / COD 800, synthetic receipt SYNTH20C01 imported BEFORE buyer submission, exact occurred_at `2026-10-25T11:15:59+00:00`, after order creation. Synthetic SMS imported through actual UI (strict fixture grammar, not evidence of real provider format support). Buyer contact 01800000007 differed from sender; Bangla sender `০১৯০০০০০০০৭` matched receipt 01900000007. No image/OTP/AI needed. Public Order Confirmed ACK-7B2E3BD9; seller Confirmed v3, Automatic allocation, accepted 100, actual COD 800. Screenshot `.cache/ticket20-evidence/automatic-receipt-first.png`.
- Fresh D order: invalid advance 1000 against total 900 visibly rejected with `Required delivery advance cannot exceed order total`; corrected to advance 100 and created once (three B orders total, not four). Buyer submitted BEFORE receipt import using +8801900000008 versus receipt 01900000008; different contact 01800000008. Public Pending Seller Review ACK-4D466A34 observed. Import exact synthetic occurrence `2026-10-25T11:17:16+00:00` then returned Confirmed orders; seller showed Confirmed v3, Automatic allocation, accepted 100, COD 800. Public portal independently showed confirmed/100/800. Screenshot `.cache/ticket20-evidence/automatic-claim-first.png`.
- Relabelled B receiving account to Synthetic B relabelled, then deactivated it. New-order dialog reported no active payment accounts and offered no order form. Existing D public destination retained original label Synthetic receiving account B and original number 01700000004, plus unchanged confirmed amounts. Account intentionally remains inactive in this synthetic dataset.
- Public confirmed views exposed commercial terms/status/acknowledgement, without buyer contact/address, sender/TrxID, raw image or internal TIME_UNCLEAR reason. This covers the observed projection, not exhaustive response-field or foreign-private-endpoint access.
- Focused supplementary offline verification: initial `npm run test:backend -- tests/test_ai_policy.py tests/test_payment_extraction.py` returned 2 pass / 15 fail at account setup (missing id). Conftest clears provider credentials but omits SELF_TEST_MODE; the locally saved true flag makes offline memory routes unavailable. Re-run with process-local `$env:SELF_TEST_MODE="false"` returned **17 pass**, including tests that explicitly enable self-test and assert no provider calls. Log `.cache/ticket20-ai-focused.log`. This is a discovered environment-isolation gap for the owning test/config ticket, not a browser pass or live provider-usage measurement. No application/test code changed or full gate rerun.

Coverage reconciliation (browser scope, not exhaustive backend acceptance): AC04, AC06, AC07, observed AC08 local/Bangla/+880 formats, AC12 automatic basis/COD, and AC16 both arrival orders exercised. AC05 only advance-above-total UI validation observed here; negative/unsafe/invalid-ID endpoint variants remain unrun in browser. AC09 manual/AI-disabled UI works; zero live-provider-call instrumentation remains unrun. Prior restart covers normal restart persistence, not AC39 outage/transaction interruption. AC01 real revoked/expired-session case pending owner dashboard action; owner agreed and was guided to Development → Users → second identity → active session → revoke/end (no key/user deletion or app sign-out). AC02 direct foreign order/account/receipt/history/evidence/export checks and AC03 same-TrxID cross-shop case still require real other-identity access. Existing foreign correction rejection alone does not close AC02. Direct foreign-image denial remains open. Full ticket is **in progress**, not complete; three recordkeeping criteria checked do not imply all covered behavior cases pass.

### Real device-session revocation observed

Owner reported revoking Shop B's device session in Clerk. Without clicking application Sign out, actual browser showed Sign in to your shop and no shop/order/account/payment/private details. Reload returned through Clerk loading; private API browser navigation `/api/seller/shop` returned UNAUTHORIZED / Missing or invalid seller identity. This demonstrates real client session revocation and unauthenticated route rejection. It does not prove immediate server invalidation of a previously issued, still-unexpired JWT; no captured-token replay was performed and ordinary sign-out is not substituted for expiry. Screenshot `.cache/ticket20-evidence/revoked-session-cleared.png`. No user/session/API key recorded. Preparing owner login as A to continue cross-shop checks; no credentials entered by agent.

### 2026-10-25 Shop A return and cross-shop browser checks (17:24 onward BST)

Owner manually authenticated A. Actual workspace was Phase 1 Synthetic Shop A, initially one order/receipt/account and no Shop B records. Created E (`SYNTHETIC — independent cross-shop TrxID E`, 900/100/800), then independently imported SYNTH20C01 into A's receiving account. The same ID was already allocated in B. Exact synthetic payment time `2026-10-25T11:25:02+00:00`, after E creation and before its submission. A receipt imported as unmatched, rather than globally used/rejected. Submitted distinct contact 01800000009 and sender 01900000007, same SYNTH20C01, manual/no image. A public Order Confirmed ACK-C22EFFFF, accepted 100/COD 800. Reopened original B C public portal under A session: original B confirmation ACK-7B2E3BD9 and 100/800 unchanged. This exercises AC03 independently in two real shops, beyond mere receipt creation. Screenshot `.cache/ticket20-evidence/cross-shop-same-trx-confirmed.png`.

Under A, followed actual Seller Access links from B's confirmed C portal and pending screenshot-bearing B portal. Both returned Order not found; A's workspace stayed two own orders/two own receipts/one own account, without B buyer fields or image. B public pending view showed terms/status only, no private image, sender, contact/address or TIME_UNCLEAR verdict. These are browser-level foreign correction/projection observations, not a direct foreign evidence-ID endpoint request.

Clicked actual Download filtered CSV under A while foreign portal query was present. Browser download completed; saved actual artifact `.cache/ticket20-evidence/shop-a-export.csv`. Read artifact locally: header + two records; contains A blue notebook and E, no B image/C/D product names. This proves observed same-shop export scope, not all arbitrary foreign-ID variants or spreadsheet import safety (Ticket 21).

No application/config/schema changes. No new automated gate. A remains authenticated in browser tab 8 (`aTab`); original agent tab 7 also exists. Direct authenticated endpoint replay unavailable through exposed browser automation; asked whether owner can open DevTools Console for a read-only real-session status check (no token shared in chat). Waiting for that capability before direct foreign evidence/account/receipt/history checks. No fake token, interception or direct DB result counted as browser acceptance.

Direct-read check prepared: `.cache/ticket20-evidence/console-read-check.js` (GET-only; token stays in closure, no response bodies/credentials printed). User opened console. Script requires localhost and exact Shop A display name; own-order 200 positive control; foreign order/history/decisions/summary/preview/receipt/evidence must match nonexistent-resource 404 envelopes; list scope checks. `node --check` passed. IDs were obtained via a narrow read-only transaction against the already confirmed Neon target with host-fingerprint guard, only synthetic resource UUIDs returned. This lookup supplies request targets and is NOT permission or browser acceptance evidence. Temporary lookup script removed. Await actual owner-executed browser request report before recording PASS. Script opened in Codex for copying; no test auth override, no minted/captured token, no HTTP interception.

### 2026-10-25 owner-run direct authenticated read checks — PASS

Owner returned `TICKET20_READ_REPORT` timestamp `2026-10-25T11:32:28.481Z` (17:32:28.481 BST). Exact prepared GET-only script ran in the localhost browser using real Shop A session. All **11 checks passed**: own-order positive control 200; foreign B order, buyer history, payment decisions, delivery summary, payment preview, receipt and private image each 404 with the same error envelope as a nonexistent resource; own order/receipt/account lists returned 200 and excluded known foreign resource IDs. This closes the previously outstanding direct foreign-image READ observation for A→B. Owning B image retrieval/persistence was separately observed earlier. Source is the owner's returned report, not agent-observed network capture. No token or private body was shared.

Remaining limits: read-only report proves no mutation/retention authorization outcomes, no B→A direct-ID matrix, no previously issued expired/revoked JWT replay, no verifier outage or database interruption, and no measured live-provider call count. Existing real client revocation, bidirectional foreign seller-correction rejection, public projections, manual/automatic flows, normal restart and same-shop export remain valid evidence. Ticket stays in progress while required remaining coverage is reconciled; do not call all AC variants passed.

### Third-compaction handoff (2026-10-25)

User chose to finish Ticket 20's remaining gaps before starting dependent Ticket 21. Updated `.scratch/ticket-20-compaction-handoff.md` with a new authoritative section at the top: owner-run 11/11 real GET result, current A session, synthetic dataset changes, denied-mutation next action, remaining token/outage/AI/validation boundaries, tooling limits and evidence paths. Previous advice to start 21 was corrected; no Ticket21 work started. Evidence-only update, no application/config/schema changes or fresh automated gate.
