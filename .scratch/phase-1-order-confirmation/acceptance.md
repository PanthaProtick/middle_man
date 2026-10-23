# Phase 1 acceptance and verification

Normative annex to [spec.md](spec.md). All cases below are required future evidence,
not results achieved by writing this specification.

## Behavior cases

| ID | Scenario | Required observable result |
| --- | --- | --- |
| AC01 | Missing/invalid seller identity; verifier unavailable | 401 or explicit 503; no seller data or mutation |
| AC02 | Shop B accesses Shop A order/account/receipt/history/evidence/export | Inaccessible; no existence/personal-data leak or effect on either shop |
| AC03 | Same TrxID appears in independently supplied records in two shops | Checking remains separate; no global buyer-claim lock |
| AC04 | Valid order creation and reload/restart | Fixed terms, unique link and 48-hour server expiry persist |
| AC05 | Negative/zero/unsafe money, advance above total, invalid IDs/fields | 422; no partial order/evidence/allocation |
| AC06 | Account relabel/deactivation after order creation | Existing payment destination stays fixed; inactive account not selectable for new orders |
| AC07 | Buyer contact differs from payment sender | Valid submission; matching uses sender, not contact |
| AC08 | Bangla digits and supported local/+880 sender representations | Canonical full number agrees; raw reviewed values remain traceable |
| AC09 | Manual-only buyer submission, no screenshot/no Gemini | Full flow works; no external AI request or mandatory upload |
| AC10 | Optional AI extraction correct, incorrect, null, malformed, late or unavailable | Buyer review/manual fallback; no automatic confirmation from AI output |
| AC11 | Invalid image, excessive bytes/pixels, foreign evidence ID | Rejected before paid extraction; no cross-order evidence access |
| AC12 | All automatic checks pass | Exactly one durable allocation and confirmation; correct actual COD and basis |
| AC13 | TrxID, full sender, provider, receiving account or amount mismatch | Pending review, no allocation; typed internal reason |
| AC14 | Missing/masked sender or unclear timestamp | No suffix inference/guessed time; explicit review path |
| AC15 | Payment before creation or after active claim submission | Manual review; server/import time is not substituted |
| AC16 | SMS imported before buyer submits, and reverse order | Same qualifying outcome after second side arrives |
| AC17 | Identical repeated SMS/manual receipt; replay after raw SMS deletion | One received payment; no duplicate funds or allocation |
| AC18 | Same transaction with different sender/account/amount observations | Conflict visible; identity not split into reusable transactions |
| AC19 | Seller resolves conflicting unallocated observations | Audited consistent receipt; eligible pending claims rechecked |
| AC20 | Two known pending orders claim one receipt | Review without first-submitter winner; seller can select one with reason |
| AC21 | New claim or contradictory receipt after confirmation | Existing confirmation preserved; later claim/conflict held and seller alerted |
| AC22 | Concurrent workers/manual+automatic decisions contend for one receipt | At most one allocation across instances; loser remains unresolved/conflicted |
| AC23 | Cancellation/correction races with matching | One serialised valid outcome; no stale-version acceptance or double use |
| AC24 | Manual confirmation without receipt, reason or owning-shop authority | Rejected without state/balance mutation |
| AC25 | Seller accepts smaller/larger advance within total | Recorded exception; actual amount preview and COD agree before/after commit |
| AC26 | Received amount exceeds total, including attempted smaller allocation | Remains unresolved; no negative COD, partial allocation or invented credit |
| AC27 | Pending buyer correction by owning seller through same portal | Prior revision retained, version changes, relevant checks rerun |
| AC28 | Anonymous/buyer-token correction attempt | No seller edit authority; no changed information |
| AC29 | Confirmed name/contact/address correction | Logged update; allocation/balance unchanged; no courier call |
| AC30 | Confirmed payment/commercial-term edit attempted | Explicit conflict; immutable values remain unchanged |
| AC31 | Initial submission immediately before/at/after expiry | Before accepted; at/after rejected as expired, atomically |
| AC32 | Page opened/draft entered before expiry but submitted afterward | Draft does not prevent expiry |
| AC33 | Pending submitted order waits beyond deadline, including failed match/correction | Never automatically expires |
| AC34 | Explicit cancellation before/after payment acceptance | Matching stops; reason/history retained; used payment never freed and no refund implied |
| AC35 | Explicit seller rejection | Terminal rejected projection; no buyer self-resubmission loop |
| AC36 | Replacement of unallocated vs allocated predecessor | Traceable new fixed terms/token for eligible replacement; allocated case requires separate resolution |
| AC37 | Timeout after possible submission/decision commit | Same-key replay/refetch resolves outcome; no fabricated success or new write key |
| AC38 | Same mutation key with different payload; stale expected version | 409 and no partial write; client preserves/refetches data |
| AC39 | Process restart/database outage mid-acceptance | All-or-nothing durable outcome; explicit outage, never memory-only confirmation |
| AC40 | Raw image/SMS/AI evidence reaches 30 days | Deletion removes raw copies, not order status, structured claim or used marker |
| AC41 | Completed record reaches 12 calendar months; unresolved dependency exists | Personal-data retention enforced without deleting structured evidence still needed by unresolved orders |
| AC42 | Personal data deleted then a used TrxID is submitted/imported again | Minimal marker still prevents payment reuse |
| AC43 | Cleanup fails or backup/log copy exists | Retry/overdue visibility and documented purge lifecycle; no false deletion-complete claim |
| AC44 | Public policy gate not configured for live operation | Public buyer operations unavailable; no implicit bearer/OTP policy |
| AC45 | Mobile buyer page success/loading/validation/network failure | Clear state, separate numbers, optional AI/upload, preserved recoverable input |
| AC46 | Polling returns late responses/page hidden or unmounted | No status regression or runaway polling; manual refresh works |
| AC47 | CSV/copy of same-shop orders with formula-like buyer text | Correct balances, private scope, safe CSV; no suggestion of courier booking |
| AC48 | Seller-only payment evidence vs buyer status projection | No raw receipt/full personal data/internal fraud verdict leaks through public projection |
| AC49 | SMS unsupported/partial/bulk mixed results | Visible per-item failures, durable successful items, manual fallback; zero Gemini calls |
| AC50 | Existing starter routes and checks | Meaningful baseline behavior preserved; no unrelated removal disguised as product implementation |

## Test boundaries confirmed by the user

| Layer | What it must prove | What it cannot establish |
| --- | --- | --- |
| FastAPI behavior/contract tests | Permission, validation, statuses, revisions, decisions, failure projection and both arrival orders | Real provider behavior or production database locking when adapters are fake |
| Disposable real PostgreSQL integration | Constraints, rollback, independent-worker contention, idempotency, restart durability and cleanup interactions | Hosted readiness or courier behavior |
| Frontend client/component tests | Exact payloads, numbers/amount labels, loading/error/stale states, optional AI/manual path, safe retries | Actual browser/mobile usability |
| Browser flows | Buyer-to-seller workflow, mobile layout, seller edits, errors, polling lifecycle and copy/export | Broad real-world provider coverage |
| Configured-provider checks | Actual seller auth, private storage, selected Gemini mode and representative receipt parsing | Product time savings from a tiny successful sample |
| Seller pilot | Repeat use, whole-workflow time and buyer completion | A general fraud-prevention or COD-return guarantee |

Prefer the highest seam that can expose the behavior. Do not mirror private helpers
or test a mock's own behavior. Freeze/inject time for expiry and retention cases;
use two database connections/process-equivalent actors for allocation contention.
Use fixtures with separate shops, payer/contact numbers, receiving accounts and
transaction identities. Preserve realistic failure cases instead of weakening assertions.

Unit tests must not call paid services or production databases. A disposable local
PostgreSQL test target must be verified before schema creation/cleanup. Provider
credentials belong only in explicitly authorized integration runs, never committed
fixtures, logs, screenshots or CSV evidence.

## Implementation gate

1. Add focused backend/frontend regressions for the changed vertical behavior.
2. Run the focused root wrappers while editing; do not pass filters to full gates.
3. Run root `npm run check` after completing code/tooling changes and record the
   fresh result JSON path and failed/unrun stages, not a previous run's status.
4. Run disposable PostgreSQL and browser cases separately. A normal offline check
   and HTTP smoke are necessary evidence but do not imply these passes.
5. Report each relevant level as PASS, FAIL, BLOCKED or NOT RUN with concise evidence.

## Provider and launch gates

- Enforced seller identity/owning-shop authorization, including expired/invalid auth,
  not merely configured Clerk keys; cross-shop checks through real endpoints.
- Selected PostgreSQL target, reviewed migrations, durable records after restart,
  independent-request allocation safety and failure recovery; no live migration in this task.
- Buyer access/projection policy explicitly settled before live public operations.
  Account-deletion behavior, including markers/backups/open disputes, settled before launch.
- Sanitised, permissioned bKash/Nagad samples covering targeted personal/retail/merchant
  flows, duplicated/modified/unknown formats, masks, date precision and receiving-account
  omission. Support is per tested format, never inferred from a provider name alone.
- Private storage permissions, decoded-upload validation and overdue/orphan deletion
  demonstrated. No screenshot or SMS content in general logs or analytics.
- Current Gemini model/data terms and disclosure reviewed; actual opt-in and outage
  fallback exercised. Stored model suggestions never count as payment receipt evidence.
- Actual public/authenticated rate-limit policies, token/referrer/log handling and CSV
  safety verified; no configuration-only security/readiness claims.
- Retention schedule for standalone unmatched receipt records without an order, and
  backup purge lifecycle, must be recorded before retaining real pilot data. The
  interview did not define a new period for these unattached structured receipts.

## Pilot evidence

Use the proposed 3-5 sellers for approximately two weeks after launch gates pass.
First observe their existing per-order process and record comparable handling-time
boundaries. Time order setup, SMS ingestion, review and exceptions in the new flow,
including bulk work allocated across orders; do not substitute elapsed buyer waiting
time for seller active effort. Compare the median and spread with the same seller's
baseline, document sample sizes and set a numerical saving target after baseline.

Track opened links/completed submissions as a privacy-conscious aggregate with bot
and repeated-open limitations stated; buyer access is not identity proof. Track repeat
seller use, confirmation/exception counts and completion alongside handling time.
Do not retain raw addresses/screenshots as analytics. Keep rejected-COD and fraud
observations descriptive. Advance to courier work only after repeat use and demonstrated
time saving; automated match rate alone is not the decision criterion.

## Status at specification delivery

Only document consistency/local-link checks have been performed for this task.
No product implementation, root gate, browser flow, database migration, live-provider
run or seller pilot is claimed. The spec's readiness label permits bounded implementation
work; it does not waive the explicit provider, public-access, deletion and evidence gates.
