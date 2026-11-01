# 02: Create orders through guided conversation

**What to build:** Prepare and confirm an awaiting-buyer order inside the assistant, then return its real buyer link and seller view.

**Blocked by:** 01: Unify the floating seller assistant and contextual review.

**Status:** implemented; local verification passed; browser/PostgreSQL acceptance not run

- [x] Interpret provided order fields locally; collect product name, positive total, positive required advance no greater than total, and active receiving account. Parcel weight and quantity remain optional under existing validation.
- [x] Ask for all missing/invalid required fields together, preserve valid answers, never invent an advance or guess between accounts; accept clear Bengali digits/currency notation and clarify ambiguous amounts.
- [x] Show an editable summary with interpreted amounts and an explicit Create order button. Edits invalidate earlier confirmation; no write occurs from a model response or conversational acknowledgement.
- [x] Revalidate shop authorization, active account, and constraints at submission through existing domain behavior; return recoverable validation/conflict messages while preserving entered fields.
- [x] Bind server-enforced submission identity to shop, action, and confirmed payload. Double clicks, concurrent retries, and lost responses cannot create duplicate orders; the same identity with changed payload cannot mutate the original action.
- [x] Resolve uncertain outcomes by submission identity before resubmitting; define recovery and retention appropriate to configured storage, including restart behavior, rather than relying on a disabled button or process-local UI flag.
- [x] Return actual awaiting-buyer result with Copy link and Open order actions. Do not collect buyer delivery details or book couriers.
- [x] Support one creation action at a time and clarify multi-action requests. Test complete/incomplete/corrected inputs, bilingual amounts, cross-shop access, stale accounts, concurrent duplicates, and failed/processing/unknown outcomes.

## Verification and handoff

Use focused checks while implementing and the root verification gate before completion.
Automated tests use fake providers with zero live Gemini calls. Record actual results,
unrun acceptance gates, remaining risks, and the next action in this ticket.

## Implementation and handoff — 2026-11-01

Base: `a714d358228b556c46788dcfda2e0755f1a56714`; current branch: `main`.
The user approved assistant UI and authenticated order API as the TDD seams.

- Added deterministic labeled-field interpretation, Bengali digits/currency/grouped
  amounts, all-field validation, editable interpreted summary, optional parcel
  validation, and explicit Create order confirmation. Ambiguous accounts and
  multi-order requests require clarification; chat acknowledgements never write.
- Added authenticated confirmed-submission context, submit, and recovery routes.
  Reused order validation and account snapshots; extracted creation from the large
  order service. Shop serialization and atomic order/receipt persistence close the
  existing two-commit duplicate window for ordinary creation too.
- Drafts and identities remain in tab React state. Unknown/processing actions freeze
  edits and new creation. Lookup must succeed before retrying the immutable payload
  with its original identity. Definitive validation failures preserve editable fields.
- Standby process epochs reject old identities after restart; durable receipts
  persist with orders, and existing retention tombstones prevent re-execution.
  See `docs/contracts/guided-order-creation.md` for the recovery/storage contract.
- Results use actual server buyer links and current seller-detail reads. The shared
  workspace owns the result dialog to preserve the assistant during portal movement.

Changed paths: `backend/app/{api/order_submissions,models/order_submission,
services/order_creation,services/order_submission,services/order_service,core/idempotency,main}.py`;
`backend/tests/test_order_submissions{,_postgres}.py`; seller assistant conversation,
workspace, window, fields, result, submission hook, parser, CSS, and UI tests;
`frontend/src/features/locale/guidedOrderCopy.ts`; API contract index and new annex.

Verification so far: focused API tests 12 passed / 2 PostgreSQL cases skipped;
guided-order UI 8 passed; existing assistant suites passed; lint and both application
typechecks passed. Initial missing-feature tests failed before implementation; a
recovery-auth regression and result-dialog regression failed before their fixes.
No live Gemini calls. Independent Standards and Spec reviews completed; both report zero remaining findings after fixes.

Remaining acceptance: disposable PostgreSQL concurrency/rollback, real browser and
mobile, hosted Clerk, and real providers are not run. Local interpretation is
intentionally bounded; help documents supported labels, and unmatched wording
requires structured input or clarification. Next: browser/mobile and disposable PostgreSQL acceptance; then ticket 03 when requested.



Final verification:

- Root `npm run check` passed: tooling, conventions, lint, types, backend/frontend
  tests, production build, and HTTP smoke. Evidence:
  `.cache/checks/check-o0f6Zz/result.json`.
- Backend: 643 passed, 179 skipped. Frontend: 518 passed across 97 files.
- Used process-local `PYTEST_ADDOPTS=--basetemp=E:/middle_man/.cache/pytest-guided-orders-20261101`
  to keep Windows pytest temporary files inside the workspace.
- Review findings resolved: repeated same-workflow requests now clarify before any
  field merge, explicit another-order requests offer keep/discard, and shared
  memory order stores moved to `services/order_store.py` without circular imports.
- No browser/mobile, PostgreSQL integration, hosted Clerk, or live-provider
  acceptance is claimed. Automated verification made zero live Gemini calls.
