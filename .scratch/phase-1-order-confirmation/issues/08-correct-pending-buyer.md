# 08: Correct pending buyer information

**What to build:** An owning seller uses the existing portal to correct pending buyer details or payment claims and sees checking run again.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** implemented — local acceptance passed; live-authentication acceptance blocked

## Acceptance criteria

- [x] Resolve the buyer link/token to an owning-seller order only through authenticated seller authority; anonymous/token-only access cannot enable corrections.
- [x] Edit pending name/contact/address and payment claim with reason and expected version; preserve prior revisions, actor and server times.
- [x] Payment-claim changes use the active claim revision's server acceptance time for matching; delivery-only corrections do not extend that bound or erase first submission time.
- [x] Reconcile relevant corrections through the same allocator, preserve pending nonexpiry and report updated private review reasons or confirmation.
- [x] Reject concurrent stale edits and correction-versus-confirmation races without last-write-wins; confirmed payment/terms cannot be changed through this interface.
- [x] Show edit/history/error states, preserve recoverable inputs and provide no buyer reject/resubmit loop. Completion/exception aggregate counts must not double-count revisions.
- [ ] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC23, AC27, AC28, AC30, AC33, AC37, AC38, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API authorization/revision/timing/nonexpiry tests; real PostgreSQL correction-versus-allocation contention; browser seller login through existing link, correction and renewed outcome.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Implementation and verification — 2026-10-24

- Added typed seller correction and paginated revision-history contracts/routes,
  `buyer_correction.py`, and migration `0008_claim_acceptance_time.sql`. Existing
  revisions are backfilled from creation time; new delivery edits retain the claim
  acceptance bound. First submission, terms, allocation and pending nonexpiry persist.
- Corrections share the shop-first allocator lock, revalidate version/lifecycle,
  append actor/reason/server-time revisions, invalidate old/new receipt versions,
  reconcile both identities, and atomically save idempotent results. Retry covers
  the entire correction transaction. Current review reasons are recomputed.
- Integrated `BuyerCorrection.tsx`, typed client and styles into order detail and
  the existing buyer portal's seller-access link. Recoverable inputs and unknown
  outcomes retain payload/key; stale edits require refresh. Confirmed payment fields
  are disabled and API-protected. Confirmed delivery edits preserve allocation/COD.
- Focused API: PASS, 12 cases (`npm run test:backend -- tests/test_buyer_corrections.py`).
  React: PASS, 2 cases (`npm run test:frontend -- src/features/seller/BuyerCorrection.test.tsx`).
- Real PostgreSQL: PASS, independent correction-versus-receipt contention through
  `tests/test_corrections_postgres.py`. Verified loopback target `127.0.0.1:55447`,
  database `postgres`, data directory `E:/middle_man/.cache/resolution-pg`; tests use
  isolated disposable schemas. All PostgreSQL tests enabled for the full gate.
- Full root gate: `npm run check` with `BUYER_TEST_POSTGRES_URL` set to that disposable
  loopback target; PASS all eight stages, including 139 backend tests; result
  `.cache/checks/check-fH07DO/result.json` (final run).
- Browser local synthetic adapter: PASS, pending portal -> seller link resolution ->
  transaction correction -> confirmed; history has two immutable revisions and the
  confirmed aggregate remains one. Loading observed; permission/unknown-outcome
  failures covered by React/API tests, not live-provider browser tests. Screenshot:
  `.cache/correction-browser-proof.png`; disposable harness `.cache/correction-browser.py`.
- Review: Standards 0 findings; Spec 1 finding (obsolete reasons) fixed with a
  red/green regression; re-review reports 0 remaining findings.
- Live seller login/configured provider: BLOCKED by the existing placeholder verifier
  in `backend/app/core/auth.py`; the current workspace uses its explicit development
  adapter. No live authentication, hosted migration, deployment, paid provider or
  real-data pilot acceptance is claimed. Public-access/retention launch gates remain.
- Next action: complete the separately scoped real seller-session integration, then
  repeat the existing-link correction browser journey with that identity boundary.
  The final integrated acceptance checkbox remains open for this reason.

## Scope boundary

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.

