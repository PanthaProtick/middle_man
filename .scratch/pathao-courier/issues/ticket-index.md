# Pathao courier ticket index

The user approved this 12-ticket breakdown. Each implementation ticket has its own file; its status and blockers determine the executable frontier. This index is navigation, not a combined implementation ticket.

| Ticket | Delivers | Blocked by |
| --- | --- | --- |
| [01](01-create-courier-drafts-on-confirmation.md) | A visible durable courier draft on manual or automatic confirmation | None |
| [02](02-capture-parcel-details-early.md) | Optional early parcel entry and later draft completion | 01 |
| [03](03-connect-seller-pathao-account.md) | Secure seller merchant connection, pickup store, and service defaults | None |
| [04](04-collect-pathao-delivery-locations.md) | Buyer location selectors, validated addresses, and outage/unsupported fallback | 03 |
| [05](05-review-booking-ready-draft.md) | Complete current-data review with correction/cancellation guards | 02, 04 |
| [06](06-submit-drafts-offline-safely.md) | Durable protected submission and outcome states through the offline adapter | 05 |
| [07](07-resolve-unknown-booking-outcomes.md) | Seller reconciliation before retrying unknown outcomes | 06 |
| [08](08-handle-post-submission-changes.md) | Accurate external-action notices for changes during/after submission | 06 |
| [09](09-submit-protected-sandbox-bookings.md) | Audited transport and actual protected sandbox submission | 07, 08 |
| [10](10-retain-and-erase-courier-data.md) | Existing retention workflow covers courier personal data and protection markers | 07, 08 |
| [11](11-remove-obsolete-neon-test-data.md) | Inventoried, verified removal of authorized obsolete development data | None |
| [12](12-verify-browser-and-sandbox-journey.md) | Browser and actual sandbox acceptance with final repository checks | 09, 10 |

Initial frontier at publication: **01, 03, 11**. As of 2026-10-26, tickets **01–03 are implemented with local verification**, and the current frontier is **04, 11**. Real Pathao acceptance remains unrun. Ticket 11 is independent of the courier implementation and is not a gate on ticket 12. Real booking transport is introduced only after attempt protection, reconciliation, and post-submission change handling exist. Production activation is outside this effort.

Each ticket includes its own acceptance and verification requirements. Use the established HTTP API/PostgreSQL seam and replace only the external courier boundary for controlled faults; retain component tests and separate actual browser/provider acceptance. Run root `npm run check` as the final gate for code/tooling changes.

Publishing tickets did not implement the feature, execute cleanup, submit courier bookings, or run application checks. The parent specification is unchanged.

Publication-time verification: **PASS** for 12 numbered files, 119 acceptance criteria, all approved blocking edges in dependency order, every ticket's initial `ready-for-agent` status, index links, and ticket whitespace/size checks. `git diff --check` also passed. Root `npm run check` was **NOT RUN** for the original documentation-only publication; later implementation checks are recorded in the individual tickets.
