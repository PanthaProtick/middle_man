# Package 13: Cross-product acceptance and staged rollout

Status 2026-11-03: **acceptance pending; rollout proposal only**.

## Review correction

Review of `86de3d0` against `e2c57a9` found that the original completion note
confused acceptance targets with executed evidence. This record supersedes its
claims of completed matrix/journeys, measured baseline improvements, and available
shop-ID canaries. No application behavior is changed by this correction.

The owning requirements are [parent plan sections 7–8](revamp-plan.md#7-cross-product-acceptance-matrix)
and [roadmap Package 13](implementation-roadmap.md#13--cross-product-acceptance-and-staged-rollout).
Package 12 performance acceptance is also still pending.

## Evidence and current disposition

| Gate | Status | Evidence / remaining work |
| --- | --- | --- |
| Historical local root check | PASS, with skips | `.cache/checks/check-aOPgDQ/result.json`; 693 backend passed, 179 skipped; 119 frontend files, 635 tests passed. This local artifact does not prove browser acceptance. |
| Review verification | PASS, with skips | `npm run check` with repository-local pytest temp; `.cache/checks/check-A3ZSKN/result.json`. All nine stages passed; 693 backend passed, 179 skipped; 119 frontend files, 635 tests passed. |
| Rendered device/locale/state matrix | NOT RUN in this review | No Package 13 per-case captures or fixture/revision manifest supplied. |
| Integrated seller → buyer → payment → delivery journey | NOT RUN in this review | Independent test cases and baseline fixtures do not prove one persisted journey. |
| Baseline task comparison / pilot comprehension | NOT RUN | Package 01 findings are expert hypotheses, not measured user baselines. |
| Performance budgets | Pending | Measure representative low-end-device behavior; chunk warnings are not a performance acceptance gate. |
| Hosted auth, PostgreSQL, providers, physical devices | NOT RUN | Separate authorized environment and operator required. |
| Deployment / rollback rehearsal | NOT RUN | No release tags, hosting target, or deployment operator recorded. |

Local cache paths are disposable operator evidence, not portable tracked artifacts.
Retain selected reusable acceptance evidence under `docs/verification/` before
claiming completion; include fixtures, source revision, viewport, locale, theme,
case outcome, capture path, and real-service paths exercised or excluded.

## Remaining acceptance cases

Execute the full parent matrix for Orders, Creation, Detail, Buyer Portal,
Payments, Delivery, Assistant, and Settings. Record PASS/FAIL/NOT RUN per applicable
case; justify non-applicable cases rather than treating them as passes.

- Widths 320, 390, 768, 1024, 1440px; 200% zoom/reflow; English and Bengali;
  mixed-script long text, unbroken IDs, zero/maximum-valid amounts, one/many pages.
- First visit, empty/no matches, initial loading, refresh with data, field errors,
  session/forbidden, transport failure, success, stale/slow responses, large content,
  unknown mutation outcomes, duplicate clicks, and lost mutation responses.
- Primary targets at least 44px, form text at least 16px, actual token contrast,
  semantic labels/headings/errors, status announcements, visible focus, keyboard
  dialogs/tabs and focus return, reduced motion, and text alongside status colors.
- Software keyboards/safe areas, assistant/detail overlap, long dialog scrolling,
  back/scroll restoration, query reset versus refresh context preservation.
- Bangladesh midnight, retained records, account deactivation, ownership changes,
  stale versions, pagination scope/deduplication, offline/manual paths without
  live credentials or external fonts.

Repeat [all eight baseline walkthrough tasks](baseline-walkthroughs.md) using
recorded fixtures: create/share, buyer claim, find work, review evidence, record
payment, correct buyer/link, delivery recovery, and session recovery. Record
observations rather than asserting all controls or flows now pass. Recruit pilot
sellers/buyers for task time, errors, navigation reversals, and comprehension;
set numeric improvement targets only after collecting comparable baselines.

Exercise an integrated synthetic order through creation/sharing, buyer claim,
receipt recording/reconciliation, seller acceptance, and delivery preparation /
unknown-outcome recovery. Preserve the distinction between claim, receipt,
acceptance, staged, ready, and booked. Keep live booking default-off; any real
provider operation requires the separately authorized environment. Include
assistant advisory boundaries and settings/account snapshot/retention cases.
Domain expectations come from the maintained [API contracts](../../docs/API_CONTRACTS.md),
not inferred UI narratives or hardcoded monetary/retention assumptions.

## Verification commands and guarantees

- Use focused `npm run test:frontend -- <test-path>` and
  `npm run test:backend -- tests/<file>.py` for changed behavior clusters.
  This review changes documentation only; no application regression test added.
- `npm run conventions` checks tracked non-Markdown scratch files, source/test
  size limits, and maintained-document links/commands within its documented scope.
  Documentation at 250 lines triggers review, not a universal 300-line ceiling.
- `npm run typecheck` checks TypeScript and Mypy. `npm run build` builds the client;
  Vite's chunk-size warning is not an enforced runtime performance budget.
- Final `npm run check` runs all nine local stages and writes a unique result JSON.
  Record actual failures/skips and adjacent logs; it does not execute browser React
  or prove live auth, database, SMS/device, or provider behavior.

## Proposed rollout and recovery

The six dependency groups are shell/access, seller queues, order/buyer lifecycle,
payments/delivery, assistant/settings, and final acceptance. These are review and
release sequencing proposals, not implemented cohort flags. Shop-ID canaries and
dual legacy/modern response compatibility must not be assumed available.

Before deployment, the release operator must select and record a compatible full
release artifact and previous known-good artifact/revision, hosting target,
asset/cache procedure, API compatibility assessment, and rollback rehearsal.
Packages can include backend changes; blindly reverting an entire package is not
a safe UI rollback. No schema change is introduced here. Any future schema change
requires its own forward-compatibility and recovery plan.

On a UI regression, restore the previous compatible frontend artifact using the
host's verified procedure, then recheck existing buyer links, seller access,
payment reconciliation, delivery recovery, and ingestion paths actually deployed.
Never erase or rewrite payment allocations, order facts, courier attempts,
idempotency records, or audit history. Do not claim zero downtime until rehearsed.

## Outstanding gate ownership

Assignments below identify required roles; no named operator has accepted them.
They block promotion until an operator and evidence are recorded.

| Gate | Required owner | Evidence needed |
| --- | --- | --- |
| Browser matrix and baseline tasks | Frontend acceptance owner, unassigned | Case manifest, captures, outcomes, pilot observations |
| Performance | Frontend performance owner, unassigned | Representative device/network measurements and budgets |
| Hosted authentication | Auth/deployment operator, unassigned | Session rotation, recovery, domain/cookie behavior |
| PostgreSQL | Database operator, unassigned | Disposable integration/concurrency results and skip resolution |
| Pathao | Courier integration operator, unassigned | Authorized trial and unknown-outcome recovery evidence |
| SMS ingestion | Device/integration operator, unassigned | Physical forwarding and malformed input cases |
| Hardware keyboards/safe areas | Device acceptance owner, unassigned | iOS/Android device results |
| Release and rollback | Release operator, unassigned | Artifact IDs, compatibility review, rehearsal and post-deploy checks |

Package 13 remains pending until its roadmap done criteria have bounded evidence.

## Review verification notes (2026-11-03)

Initial `npm run check` failed: 692 backend passed, 179 skipped, one setup error
from inaccessible system pytest temp. Result finalization also failed with EPERM;
`.cache/checks/check-1hzgEu/result.json` remains RUNNING and is not a pass.
Retry command: `($env:PYTEST_ADDOPTS = '--basetemp=E:/middle_man/.cache/pytest-review-86de3d0')`
then `npm run check`. The retry passed all nine stages. Backend environment-dependent
cases remain skipped; browser/live-service/deployment gates remain NOT RUN.
The only subsequent changes record these verification results.
