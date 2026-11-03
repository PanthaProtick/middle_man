# Remove seller payment SMS import

Status: ready-for-agent

## Problem Statement

The seller no longer wants the payment SMS pasting feature. Its import panel,
batch parsing, results and import history add an unwanted payment-entry workflow.
Hiding the panel alone would leave an unsupported ingestion API and maintenance
burden. The existing parser supports a synthetic fixture grammar, not validated
general provider message formats.

## Solution

Remove seller payment SMS import end to end. Sellers continue to record received
payments manually or through guided transaction entry and review payment matches.
Existing seller transaction records and their effects on orders remain intact.
Remove active SMS-import instructions and entry points in both supported locales.

## User Stories

1. As a seller, I want the Payments area to omit SMS pasting, so that I see only supported payment workflows.
2. As a seller, I want SMS batch results and import-history controls removed, so that obsolete tools do not distract me.
3. As a seller, I want manual payment recording to remain accessible, so that I can record observations from my payment app.
4. As a seller, I want guided transaction entry to remain available, so that I can prepare and confirm a seller transaction record conversationally.
5. As a seller, I want receiving-account selection preserved where payment entry needs it, so that records belong to the correct account.
6. As a seller, I want existing SMS-origin transaction records preserved, so that past payment decisions remain understandable.
7. As a seller, I want existing payment allocations preserved, so that removing an input method does not change confirmed orders.
8. As a seller, I want manual records to retain normal matching and exception handling, so that I can continue resolving buyer payment claims.
9. As a seller, I want payment recording to retain duplicate and retry protections, so that a repeated submission does not fund another order.
10. As a Bengali-speaking seller, I want obsolete SMS instructions removed from Bengali screens, so that the interface remains accurate.
11. As an English-speaking seller, I want payment headings and guidance updated, so that they describe the remaining workflows.
12. As a buyer, I want my payment-claim submission and order status preserved, so that this seller-side removal does not interrupt my order.
13. As a shop owner, I want historical records to remain isolated to my shop, so that retirement does not expose private payment details.
14. As a shop owner, I want previously collected raw messages to retain their deletion deadlines, so that feature removal does not abandon data cleanup.
15. As a maintainer, I want obsolete ingestion endpoints and dedicated parser code removed, so that the feature cannot still be used through direct requests.
16. As a maintainer, I want fresh and upgraded databases to remain usable, so that retirement does not break startup or maintenance jobs.
17. As a maintainer, I want current contracts to describe the retired surface accurately, so that future work does not restore it accidentally.

## Implementation Decisions

- Remove the dedicated SMS panel, batch handling, import-result/history interface,
  API client operations, feature-only types, styles and translations.
- Remove both seller SMS ingestion and import-history API routes and their
  registration. Requests to either retired route must return 404 without writes
  or disclosure of historical imports; verify authenticated requests explicitly.
- Remove parser, request models and import orchestration used solely for active
  ingestion. Trace cleanup, status, redaction, reset and storage callers first;
  keep the smallest historical-data support needed by those callers.
- Preserve manual and guided seller transaction entry, receiving accounts, receipt
  reconciliation, seller decisions, shop isolation, idempotency and recovery rules.
  A legacy SMS source value may remain on historical records; it must not enable
  new imports. Shared receipt infrastructure is not obsolete import code.
- Preserve existing structured seller transaction records, payment allocations,
  order statuses, accepted advances and remaining COD balances. Do not recreate,
  rematch or delete them as a side effect of retirement.
- Preserve historical raw-evidence cleanup and structured retention obligations.
  Historical evidence must not gain a new deadline or be restored. Import-history
  UI removal does not authorize a destructive data purge or removal of cleanup.
- Do not rewrite applied migrations or drop historical tables merely because
  their UI disappeared. Prefer retaining legacy storage and necessary cleanup
  over an irreversible migration. Add a forward migration only if required for
  compatibility, with explicit preservation checks and rollback limitations.
- Update current API/product contracts and glossary wording during implementation.
  Revise the SMS-input portion of the seller-supplied-payment-evidence ADR while
  retaining its seller-evidence and non-provider-verification principles. Preserve
  historical planning and acceptance records as history.
- This spec records the approved target behavior; current application contracts
  remain unchanged until implementation. No new payment-provider integration,
  replacement importer or AI extraction capability is introduced.

## Testing Decisions

- The user confirmed the existing seller Payments UI and API boundaries, plus
  focused retention/migration checks for historical data, as the test seams.
- Test externally observable behavior rather than component internals, deleted
  symbols or source-text snapshots. Reuse existing seller payment UI tests,
  transaction endpoint tests and retention/database fixtures.
- At the Payments UI boundary, verify the absence of SMS import/history controls,
  continued manual entry and guided entry, usable navigation, and English/Bengali
  labels. Preserve meaningful transaction-inbox assertions when labels change.
- At the API boundary, verify both retired routes return 404 and do not create
  observations. Verify manual recording still succeeds, rejects invalid input,
  respects owning-shop boundaries, handles retries and preserves matching rules.
- Seed historical SMS-origin receipts and allocations. Verify retirement leaves
  their identities, order relationships and payment values intact. Verify raw
  cleanup remains repeatable and respects original deadlines, and structured
  cleanup continues without importing deleted ingestion services.
- Exercise existing offline standby coverage. Where database changes or durable
  retention paths are affected, run disposable PostgreSQL fresh-schema and
  upgrade coverage; report unavailable database verification as unrun.
- Remove tests exclusive to the deleted feature; retain shared reconciliation,
  retention, manual-entry and guided-entry regression coverage.
- Run focused tests per implementation cluster, then root `npm run check` as the
  final code-change gate. Record exact results in this ticket. Browser acceptance
  must check the remaining payment workflow at mobile and desktop sizes; mock
  tests and HTTP smoke do not establish browser or live-provider acceptance.

## Out of Scope

- Disabling ordinary paste in text fields, buyer-link copying or browser clipboard behavior.
- Removing manual or guided transaction entry, the seller agent, or receiving accounts.
- Changing payment matching, seller authority, buyer claims or order confirmation policy.
- Deleting historical receipts, allocations or raw evidence outside existing retention rules.
- Adding CSV import, replacing SMS with screenshots, or integrating payment providers.
- Broad payment-screen redesign, unrelated checkout changes or hosted deployment.

## Further Notes

The user confirmed complete seller SMS-import removal while retaining manual
transaction entry and existing payment records. The conservative historical-data
policy above follows that preservation boundary; no irreversible purge is authorized.

Repository inspection baseline: `0badffcdbf9eefa4dea0ad84971fa9817b2336ef`.
The initial inspection observed an unrelated seller metrics stylesheet change;
recheck the checkout and preserve unrelated work before implementation.

This ticket is specification-only. No implementation, database migration, browser
acceptance or root verification run has been performed for the removal yet.
