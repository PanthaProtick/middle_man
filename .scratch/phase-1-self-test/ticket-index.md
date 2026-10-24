# Phase 1 local self-test ticket index

The user approved this context-bounded 22-ticket breakdown on 2026-10-24.
Status at publication: every ticket is ready-for-agent; implementation has not started.
The parent specification is unchanged. Its readiness label does not mean evidence
has passed or that deployment, real-data use or arbitrary database migration is authorized.

## Source contracts

- [Self-test implementation specification](spec.md)
- [Local self-test checklist](../../docs/phase-1-self-test.md)
- [Readiness plan](../../docs/phase-1-readiness-plan.md)
- [Domain glossary](../../GLOSSARY.md)
- [Independent application secrets ADR](../../docs/adr/0002-independent-application-secrets.md)
- [Buyer-link authority ADR](../../docs/adr/0003-buyer-link-authority.md)
- [Original AC01–AC50](../phase-1-order-confirmation/acceptance.md)

## Tickets and blocking edges

| Ticket | Blocked by | Publication status |
| --- | --- | --- |
| [01: Fail explicitly when durable storage is unavailable](issues/01-durable-self-test-mode.md) | None | ready-for-agent |
| [02: Separate saved-link encryption from Clerk credentials](issues/02-independent-link-encryption.md) | 01 | ready-for-agent |
| [03: Separate payment-marker protection from Clerk credentials](issues/03-independent-payment-markers.md) | 01 | ready-for-agent |
| [04: Sign in and open the owning shop](issues/04-real-seller-sign-in.md) | 01 | ready-for-agent |
| [05: Handle session loss and reject foreign-shop access](issues/05-session-loss-shop-isolation.md) | 04 | ready-for-agent |
| [06: Disable AI while preserving manual entry](issues/06-manual-only-ai-disabled.md) | None | ready-for-agent |
| [07: Open a buyer link with a safe public projection](issues/07-buyer-link-public-projection.md) | 02, 04 | ready-for-agent |
| [08: Submit once and recover an uncertain response](issues/08-manual-submission-recovery.md) | 06, 07 | ready-for-agent |
| [09: Bound public request admission](issues/09-public-request-limits.md) | 07 | ready-for-agent |
| [10: Revoke buyer-link access](issues/10-revoke-buyer-link.md) | 08 | ready-for-agent |
| [11: Reissue a link for the same order](issues/11-reissue-buyer-link.md) | 10 | ready-for-agent |
| [12: Keep replacement links isolated](issues/12-replacement-link-isolation.md) | 08 | ready-for-agent |
| [13: Persist and privately retrieve screenshots](issues/13-durable-private-screenshots.md) | 08, 09 | ready-for-agent |
| [14: Recover from screenshot storage failures](issues/14-screenshot-storage-recovery.md) | 13 | ready-for-agent |
| [15: Verify durable receipt-to-confirmation behavior](issues/15-durable-payment-journey.md) | 03, 08 | ready-for-agent |
| [16: Verify conflict and correction recovery](issues/16-payment-review-recovery.md) | 15 | ready-for-agent |
| [17: Verify payment contention and outage boundaries](issues/17-payment-contention-outages.md) | 16 | ready-for-agent |
| [18: Run raw-evidence cleanup with safe retries](issues/18-raw-evidence-cleanup.md) | 14 | ready-for-agent |
| [19: Delete eligible personal records without releasing payments](issues/19-personal-retention-replay.md) | 15, 18 | ready-for-agent |
| [20: Record the real-session manual browser journey](issues/20-real-session-browser-journey.md) | 05, 13, 15 | ready-for-agent |
| [21: Record browser recovery and seller utilities](issues/21-browser-recovery-utilities.md) | 11, 12, 14, 16, 20 | ready-for-agent |
| [22: Reconcile acceptance evidence and verify the final candidate](issues/22-final-acceptance-evidence.md) | 17, 19, 21 | ready-for-agent |

Start with 01. Ticket 06 is independently startable. Afterward select any ticket
whose declared blockers are complete. Individual ticket files own current status
and results; this table is the publication snapshot, not a second live status tracker.
Dependencies express prerequisites, not permission to run work concurrently in a
shared checkout. Endpoint additions include their own owning/foreign identity tests.

## Context budget and delivery rules

- Read this index, the selected ticket, relevant spec sections and only the owning
  code/callers/contracts/tests. Do not load all tickets or all historical reports.
- Each ticket has one observable outcome, bounded context, focused verification
  and exclusions. Reuse existing seams and fixtures; avoid speculative prefactoring.
- Prefer a small scenario matrix and concise result summaries. Broad permission
  checks in 05 are a bounded sweep of shared authorization, not a rewrite of each service.
- Verification tickets 15–19 reuse existing behavior and add only reproduced-gap
  regressions. Separate fixes that cross multiple domain boundaries before expanding.
- Reserve substantial context for debugging and verification. No fixed token count
  guarantees safety. Before context becomes tight, update the same ticket with
  decisions, changed paths, exact results/log pointers, open risks and the next action.
- After two failures under one hypothesis, gather new evidence and revise it.
  Unexpected architectural scope is a recorded follow-up, not a hidden expansion.
- During changes run focused checks. For code/tooling changes, run root
  `npm run check` strictly as the final handoff gate. Record failed, skipped and
  unrun checks honestly. Evidence-only tickets need their named actual observations;
  ticket 22 additionally runs the final combined-candidate gate.
- Offline automated tests remain independent of live credentials. Real Clerk/Neon
  browser acceptance is separate evidence; mocks and HTTP interception cannot replace it.
- Inspect the exact intended development target before schema operations. Destructive
  tests use disposable databases, never the persistent manual self-test dataset.
  Never print environment secrets, buyer tokens or private payment records.
- Use synthetic orders/SMS/generated images only. Keep uploaded files ignored and
  private. Gemini is disabled; Drive/cloud storage and hosted/real-seller acceptance
  remain deferred. Live session identifiers belong outside sanitized evidence.
- Additive access/key changes preserve existing data or explicitly stop on unsupported
  compatibility. No reset, ignored marker or regenerated fallback key may bypass safety.
- Tickets 20–22 record evidence and route substantial defects to their owning tickets.
  They cannot accumulate an unbounded repair backlog and still be treated as small slices.

## Acceptance coverage

- 01: AC39, AC50.
- 02: AC04, AC39, plus independent-encryption regressions.
- 03: AC17, AC42, plus independent-marker regressions.
- 04: AC01, initial AC02, AC50.
- 05: AC01, AC02, AC28, AC48.
- 06: AC09, disabled portion of AC10, AC49.
- 07: AC04, AC44, AC48.
- 08: AC05, AC07–AC09, AC28, AC31–AC33, AC37–AC38.
- 09: Ingress portion of AC11, error portion of AC45.
- 10: AC02, AC28, AC37–AC38, AC48 plus revocation cases.
- 11: AC04, AC31–AC38 plus reissue cases.
- 12: AC30, AC34–AC36, AC48.
- 13: AC02, AC11, AC39, AC48.
- 14: AC11, AC37–AC39, storage portion of AC43.
- 15: AC03, AC06, AC08, AC12–AC18, AC21, AC37, AC39, AC49.
- 16: AC19–AC21, AC24–AC30, AC34–AC35, AC38.
- 17: AC20, AC22–AC23, AC37–AC39.
- 18: AC17, AC40, AC43.
- 19: AC41–AC43.
- 20: Browser evidence for AC01–AC09, AC12, AC16, AC39, AC48.
- 21: Browser evidence for AC10 disabled/manual, AC11, AC19–AC21, AC24–AC38, AC45–AC48 plus link-access cases.
- 22: Final reconciliation of AC01–AC50 and all added self-test cases.

Coverage labels identify responsibility, not results. Ticket 22 reconciles every
original case and added policy case against the final candidate. Required missing
PostgreSQL/browser evidence blocks local completion; precisely scoped live-AI,
representative-SMS, hosted and real-seller evidence stays explicitly deferred.

## Completion claim

Only claim **local synthetic self-test passed** after applicable evidence and the
final gate pass. Update the existing original Phase 1 tickets when their behavior
changes, without replacing their history or treating old publication labels as proof.
