# Bengali/English localization ticket index

Spec: [../spec.md](../spec.md)

Design brief: [../../../tasks/bengali-english-localization-design.md](../../../tasks/bengali-english-localization-design.md)

| Ticket | Title | Blocked by |
| --- | --- | --- |
| [01](01-shared-locale-foundation.md) | Shared locale foundation | — |
| [02](02-buyer-portal-shell-terms-status.md) | Buyer portal shell, order terms, status | 01 |
| [03](03-buyer-form-validation-address.md) | Buyer form, validation, address assistance | 01, 12 |
| [04](04-seller-shell-onboarding-session.md) | Seller shell, onboarding, session UI | 01 |
| [05](05-seller-orders-create-details-links.md) | Seller orders, creation, details, links | 01 |
| [06](06-payments-inbox-accounts-exceptions.md) | Payments inbox, accounts, exceptions | 01 |
| [07](07-payment-history-evidence-retention.md) | Payment history, evidence, retention | 01 |
| [08](08-courier-draft-review-parcels.md) | Courier draft, review, parcels | 01 |
| [09](09-courier-reconciliation-pathao-settings.md) | Courier reconciliation, Pathao settings | 01 |
| [10](10-buyer-corrections-order-outcomes.md) | Buyer corrections, order outcomes | 01 |
| [11](11-copied-summaries-csv.md) | Copied summaries and CSV | 01, 05, 08 |
| [12](12-backend-presentation-contract.md) | Backend presentation contract | 01 |
| [13](13-clerk-authentication-localization.md) | Embedded Clerk localization | 01, 04 |
| [14](14-typography-responsive-accessibility.md) | Typography, responsive, accessibility | 02–11, 13 |
| [15](15-vocabulary-audit-final-gate.md) | Vocabulary review and final gate | 11–14 |

## Notes

- Implementation runs on a single integration branch, one worktree/branch per
  ticket.
- Out of scope by spec: developer demo, Gemini playground, data explorer,
  developer details panel, internal docs, new outbound notification channels.
- Browser, phone, live Clerk, and live Pathao/payment-provider acceptance cannot
  be established by unit tests and must be reported as such.
