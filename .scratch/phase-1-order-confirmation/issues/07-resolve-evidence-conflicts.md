# 07: Resolve conflicting evidence and competing claims

**What to build:** A seller compares conflicting observations or competing orders and records an explicit resolution that lets an eligible exact match proceed.

**Blocked by:** [05: Confirm exact payment matches safely](05-safe-exact-match-confirmation.md)

**Status:** completed

## Acceptance criteria

- [x] Present same-shop receipt observations, competing active claims, mismatch explanations and existing allocation state without publicly labelling a buyer fraudulent.
- [x] Require owning-seller authority, expected version and reason to select consistent unallocated evidence or resolve competing claims; preserve the observations and rejected alternatives as history.
- [x] Resolving a competing claim is an explicit audited seller decision, not an automatic first-submitter preference; ineligible/unresolved claims remain held rather than silently receiving funds.
- [x] Reconcile after committed resolution; exact eligible outcomes use the existing atomic single-use allocator. Do not introduce amount/sender/time override controls until ticket 10.
- [x] Late contradictory evidence or claims alert the seller but cannot edit an accepted allocation, undo confirmation or release the payment.
- [x] Resolve stale/unknown outcomes by refetch/same-key retry and show meaningful UI conflicts; concurrent resolution cannot allocate twice.
- [x] Complete this behavior through durable PostgreSQL records, typed FastAPI contracts and the integrated React UI; include loading, validation, permissions and failure behavior. Preserve meaningful starter behavior (AC50).

## Contract and acceptance references

- [Phase 1 specification](../spec.md), [domain/state contract](../domain-contract.md), [API/UI contract](../api-contract.md) and [acceptance annex](../acceptance.md) are normative.
- Acceptance coverage for this slice: AC02, AC18, AC19, AC20, AC21, AC22, AC24, AC30, AC37, AC38, AC48, AC50. Cases shared with other tickets are completed incrementally; a mapping is not a claim of a passing test.
- Use the [domain vocabulary](../../../GLOSSARY.md) and [seller-evidence trust decision](../../../docs/adr/0001-seller-supplied-payment-evidence.md). Confirmation means seller acceptance, not independent provider verification.

## Verification and completion evidence

API resolution/audit/privacy tests; real PostgreSQL concurrent competing-resolution checks; browser compare, resolve and verify one accepted order while another remains unresolved.

- Run focused root test wrappers during implementation and root `npm run check` before completion. Record exact results and the fresh result artifact; report real PostgreSQL, browser and configured-provider checks separately as PASS, FAIL, BLOCKED or NOT RUN.
- Verify the disposable PostgreSQL target before schema changes/cleanup. Keep ordinary tests offline with explicit adapters; never use production databases or paid services for unit tests.
- Record changed behavior, checks/results, unresolved gates and the next action here before handoff. A ticket is complete only when its user outcome works, not when one layer is implemented.

## Boundaries

Implement only this approved slice and its required seams; blockers must complete first. Do not replace the stack, fabricate successful writes or expand into courier/payment-processing features. The shared spec's public-access, account-deletion, standalone-receipt retention and provider/storage/rate-limit/backup launch gates remain binding. Implement gated interfaces without selecting deferred policy or treating a configuration flag as readiness. Publication of this ticket does not authorize deployment, live migrations or real-data pilot operation.


## Completion record — 2026-10-24

- Added owning-seller GET comparison and POST resolution contracts. Decisions require
  expected receipt version, a complete same-receipt observation, a nonblank reason,
  and a mutation key; optional claim selection explicitly holds other current revisions.
- Existing PostgreSQL audit events durably retain the selected observation, selected
  order, rejected revision IDs, actor, reason and time. Original observations remain
  unchanged. No schema migration was needed; no hosted database was accessed.
- Reconciliation uses these revision-specific decisions and the existing exact-match
  allocator. Ineligible choices remain pending; newer claim revisions are not silently
  excluded. Accepted allocations cannot be reassigned or released by resolution.
- Extended the existing shop lock to manual observations, claim admission, resolution
  and recovery reconciliation. Same-shop writes serialize before order/receipt locks;
  this favors correctness for Phase 1's single operator over same-shop throughput.
  New claims invalidate receipt versions. Late contradictory receipts keep used state
  and appear as seller conflicts without changing accepted amounts or COD.
- Integrated comparison, explicit decision, adjacent validation guidance, loading,
  permission/failure handling, immutable-allocation display and history into the seller
  inbox. Unknown outcomes retain the exact key/payload; stale decisions refetch.
- Changed paths: backend `models/resolution.py`, `services/{evidence_resolution,
  receipt_comparison,resolution_history,reconciliation,reconciliation_db,buyer_service,
  transaction_service}.py`, `api/transactions.py`, `main.py`; frontend seller
  `EvidenceResolution.{tsx,css,test.tsx}`, `resolution.ts`, `TransactionInbox.tsx`,
  `SellerWorkspace.tsx`, `api.ts`; API/PostgreSQL regression tests and lock-wait helper;
  architecture/API notes and this ticket.

### Verification

- Focused resolution HTTP tests: PASS, 9 tests; initial red test returned missing-route
  404, then passed after implementing the public API seam.
- Disposable real PostgreSQL: PASS, 5 resolution tests, including independent same-key
  and competing decisions, mixed claim/observation races, rollback of allocation/audit/
  replay on injected persistence failure, durable refetch/replay and changed-key payload
  rejection. Fresh cluster `.cache/resolution-pg`, bound only to `127.0.0.1:55447`;
  fixture validates loopback and applies actual migrations in unique disposable schemas.
- Focused React tests: PASS, 3 tests (same-key unknown-outcome retry, stale refetch,
  loading and permission failure). No live identity or payment provider was used.
- Root `npm run check`: PASS, all eight stages, **126 backend / 47 frontend tests**,
  with `BUYER_TEST_POSTGRES_URL` explicitly set to the disposable loopback target.
  Fresh artifact: `.cache/checks/check-d9KoWg/result.json`.
- Earlier root runs failed import lint and then SMS history route shadowing; these
  were fixed. The final gate includes the original SMS history assertions. Real PG
  testing also exposed pending duplicate review reasons; explicit flush boundaries
  fixed the issue without dropping assertions.
- Browser: PASS, built React app served locally with isolated PostgreSQL and explicit
  synthetic seller/public adapters. Compared two observations and two pending claims,
  selected exact evidence and one claim with reason, observed one confirmed order and
  one pending held claim, immutable allocation/history, and persistence after reload.
  Screenshots: `.cache/resolution-browser.png` (full page) and
  `.cache/resolution-browser-result.png` (result). Component tests establish loading/error
  states; browser evidence here establishes the integrated success/reload flow.
- Code review: PASS on standards and specification axes via independent reviewers;
  final follow-up found no actionable remaining issues. Query amplification was fixed;
  shop serialization is the documented trade-off.
- Configured/live Clerk, payment provider, hosted PostgreSQL and deployment: NOT RUN.
  Existing public-access/retention/provider/storage/rate-limit/backup launch gates remain
  binding; local synthetic acceptance does not establish production readiness.

Next action: proceed to the next approved unblocked ticket; ticket 10 retains all
amount/sender/time exception controls. No deployment or real-data pilot was performed.
