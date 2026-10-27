# Bengali/English localization ticket index

Spec: [../spec.md](../spec.md)

Approved breakdown: 13 end-to-end slices. Each ticket includes typography,
accessibility, behavior tests, and verification; the final ticket checks the
integrated experience. Backend presentation changes belong to the workflow that
needs them, rather than a separate backend-only dependency.

| Ticket | Title | Blocked by |
| --- | --- | --- |
| [01](01-language-switching-buyer-summary.md) | Language switching and buyer order summary | None |
| [02](02-buyer-submission-delivery-locations.md) | Buyer submission and delivery locations | 01 |
| [03](03-address-assistance-language-replay.md) | Address assistance without repeated AI requests | 01 |
| [04](04-seller-shell-onboarding-session.md) | Seller onboarding and workspace navigation | 01 |
| [05](05-seller-orders-create-details-links.md) | Order creation, details, and buyer links | 01 |
| [06](06-payments-inbox-accounts-exceptions.md) | Receiving accounts and payment matching | 01 |
| [07](07-payment-history-evidence-retention.md) | Payment history, evidence, and retention | 01 |
| [08](08-courier-draft-review-parcels.md) | Courier draft review and submission outcomes | 01 |
| [09](09-courier-reconciliation-pathao-settings.md) | Pathao settings and courier reconciliation | 01 |
| [10](10-buyer-corrections-order-outcomes.md) | Buyer corrections and order outcomes | 01 |
| [11](11-copied-summaries-csv.md) | Copied summaries and English CSV exports | 01 |
| [12](12-embedded-authentication.md) | Embedded authentication | 01 |
| [13](13-cross-workflow-acceptance-vocabulary.md) | Cross-workflow acceptance and vocabulary review | 02–12 |

## Working the frontier

- Start with ticket 01. After it completes, tickets 02–12 are independently
  unblocked. Ticket 13 follows all of them.
- Keep existing unmigrated behavior working and checks passing per slice.
  Separate translated copies of screens and a repository-wide flag day are not
  needed.
- No branch/worktree topology is mandated. Shared-file coordination does not add
  functional blocking edges.
- Use the approved rendered user journeys and backend request boundaries. Owner
  review of remaining vocabulary and browser/authentication acceptance are required
  before claiming completion.
- Preserve offline/manual paths. No deployment, new messaging service, real payment,
  or live courier booking is introduced by these tickets.

## Revision history

The owner approved this 13-ticket breakdown. It replaces the incomplete prior
15-position draft. The initial foundation and buyer summary are one visible slice;
manual submission and AI assistance are separate slices; embedded authentication
is ticket 12; typography/accessibility belong to each slice; integrated acceptance
is ticket 13. The old missing backend-only ticket is replaced by workflow-owned
contract changes. The parent specification is unchanged.
