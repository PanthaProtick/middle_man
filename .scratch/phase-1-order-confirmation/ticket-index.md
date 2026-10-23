# Phase 1 implementation ticket index

The user approved this revised 19-slice breakdown and authorized ticket creation on
2026-10-23. Tickets are published to the local Markdown tracker; no application work
has started. The [specification](spec.md) and its annexes remain authoritative.

## Tickets and blocking edges

| Ticket | Blocked by | Status at publication |
| --- | --- | --- |
| [01: Set up an authenticated shop and receiving accounts](issues/01-seller-workspace.md) | None | ready-for-agent |
| [02: Create an order and retrieve its buyer link](issues/02-create-order-links.md) | 01 | ready-for-agent |
| [03: Submit buyer details and see pending status](issues/03-manual-buyer-submission.md) | 02 | ready-for-agent |
| [04: Record and inspect received payments manually](issues/04-manual-received-payments.md) | 01 | ready-for-agent |
| [05: Confirm exact payment matches safely](issues/05-safe-exact-match-confirmation.md) | 03, 04 | ready-for-agent |
| [06: Import payment SMS with manual fallback](issues/06-sms-import.md) | 05 | ready-for-agent |
| [07: Resolve conflicting evidence and competing claims](issues/07-resolve-evidence-conflicts.md) | 05 | ready-for-agent |
| [08: Correct pending buyer information](issues/08-correct-pending-buyer.md) | 05 | ready-for-agent |
| [09: Correct unallocated seller transaction records](issues/09-correct-unallocated-receipts.md) | 07 | ready-for-agent |
| [10: Accept payment exceptions with a COD preview](issues/10-manual-payment-exceptions.md) | 07 | ready-for-agent |
| [11: Cancel, reject or replace an order](issues/11-order-outcomes-replacement.md) | 05 | ready-for-agent |
| [12: Correct confirmed delivery details](issues/12-confirmed-delivery-corrections.md) | 05 | ready-for-agent |
| [13: Attach optional screenshots privately](issues/13-private-screenshot-upload.md) | 03 | ready-for-agent |
| [14: Use optional AI address suggestions](issues/14-ai-address-assistance.md) | 03 | ready-for-agent |
| [15: Use optional AI screenshot extraction](issues/15-ai-screenshot-extraction.md) | 13 | ready-for-agent |
| [16: Refresh pending status reliably](issues/16-pending-status-refresh.md) | 05, 11 | ready-for-agent |
| [17: Copy and export order summaries](issues/17-order-copy-export.md) | 05 | ready-for-agent |
| [18: Run raw-evidence cleanup and expose failures](issues/18-raw-evidence-cleanup.md) | 06, 13, 14, 15 | ready-for-agent |
| [19: Remove completed personal records without releasing payments](issues/19-structured-retention-used-markers.md) | 08, 09, 11, 12, 18 | ready-for-agent |

Start with ticket 01. Thereafter work any ticket whose listed blockers are complete;
ready-for-agent describes specification readiness, not completed prerequisites or
permission to launch. For example, 02 and 04 can start after 01; 03 follows 02.
Individual ticket files own current implementation status and completion evidence.
This table records the publication snapshot, not a second live status tracker.

## Acceptance coverage

Every ticket also preserves AC50 (existing starter behavior). Repeated case ownership
reflects distinct entry points or later extensions, not permission to defer the initial
slice's safety. Test each case against every implemented path that can affect it.

| Acceptance case | Tickets |
| --- | --- |
| AC01 | 01 |
| AC02 | 01, 02, 04, 06, 07, 08, 09, 10, 11, 12, 13, 17, 18, 19 |
| AC03 | 04, 05 |
| AC04 | 02 |
| AC05 | 01, 02, 03, 04, 17 |
| AC06 | 01, 02 |
| AC07 | 03, 05 |
| AC08 | 03, 05 |
| AC09 | 03, 13, 14, 15 |
| AC10 | 14, 15 |
| AC11 | 13, 15 |
| AC12 | 05, 17 |
| AC13 | 05, 06, 10 |
| AC14 | 04, 05, 06, 10 |
| AC15 | 05, 06, 10 |
| AC16 | 05, 06 |
| AC17 | 04, 05, 06, 09, 18, 19 |
| AC18 | 04, 05, 06, 07, 09 |
| AC19 | 07, 09 |
| AC20 | 05, 07, 10 |
| AC21 | 05, 06, 07, 09, 10, 19 |
| AC22 | 05, 07, 09, 10 |
| AC23 | 08, 09, 11 |
| AC24 | 07, 10 |
| AC25 | 10 |
| AC26 | 10 |
| AC27 | 08 |
| AC28 | 03, 08, 12, 13, 14, 15 |
| AC29 | 12 |
| AC30 | 07, 08, 09, 11, 12 |
| AC31 | 02, 03, 13, 14, 15 |
| AC32 | 02, 03, 13, 14, 15 |
| AC33 | 03, 08, 16, 19 |
| AC34 | 11, 16, 19 |
| AC35 | 11, 16 |
| AC36 | 11 |
| AC37 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17 |
| AC38 | 01, 02, 03, 04, 05, 07, 08, 09, 10, 11, 12, 13, 14, 15 |
| AC39 | 01, 02, 03, 04, 05, 06, 18, 19 |
| AC40 | 06, 13, 14, 15, 18 |
| AC41 | 19 |
| AC42 | 18, 19 |
| AC43 | 18, 19 |
| AC44 | 03, 13, 14, 15, 16 |
| AC45 | 03, 13, 14, 15, 16 |
| AC46 | 16 |
| AC47 | 17 |
| AC48 | 02, 03, 04, 05, 07, 08, 11, 12, 13, 14, 15, 16, 17, 18, 19 |
| AC49 | 06 |
| AC50 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19 |

## Delivery boundaries

- Each ticket includes durable storage, typed API, integrated UI and meaningful tests
  for one user outcome. Adapt existing scaffold seams only as necessary for that slice.
- Basic pending/confirmed status ships with 03/05; 16 enhances refresh behavior.
  Conflict holding ships with 04/05; 07 adds resolution, and 10 adds manual exceptions.
- Extend allocation contention tests when manual decisions (10), buyer/receipt edits
  (08/09) and cancellation/replacement (11) arrive. Parallel branches must rerun the
  combined contention matrix after integration; earlier green evidence cannot establish
  safety of a path that did not yet exist.
- Raw-evidence ownership/deadlines ship with ingestion/upload/AI. Ticket 18 runs cleanup;
  real-data use must wait for cleanup and all applicable policy/provider gates.
- Minimal privacy-safe measurement ships alongside setup, submission and confirmation
  (01/03/05), with timing guidance in 17. Baseline observation can start independently.
  The [pilot procedure](acceptance.md#pilot-evidence) remains the evaluation contract;
  no new dashboard or unconditional pilot launch is authorized.
- Buyer access/projection, account deletion, unmatched structured-receipt retention,
  actual providers, rate limits and backup purge remain explicit launch gates. Their
  unresolved status does not authorize an agent to invent a policy.
- Root checks, real PostgreSQL tests, browser flows and configured-provider acceptance
  are separate evidence levels. Publishing these tickets proves none of them.

