# Remove seller SMS UI
Status: resolved
Blocked by: none

Implement frontend requirements in ../spec.md. Remove panel, client methods, dedicated types/styles/translations. Update remaining payment guidance in both locales. Preserve manual/guided entry, receiving accounts and inbox behavior. Use confirmed Payments UI seam with TDD. Run focused frontend tests. Record checks and limits below.

## Answer

Removed the SMS panel, dedicated import client/types/styles/tests and import-only
translations. Payment navigation now says Payments / পেমেন্ট. The evidence step
opens the existing manual-entry modal; the reconciliation link still targets the
ledger. Historical SMS source labels and evidence-retention presentation remain.
Landing examples now describe seller payment records rather than merchant SMS
imports or unsupported provider verification. Existing date/search tests retain
their assertions with updated navigation labels.

Validation:
- Red: new PaymentsSection English/Bengali cases failed on SMS controls before removal.
- Green: PaymentsSection, PaymentsWorkspace, TodayFilter, TransactionDates,
  ManualTransactionLocale, GuidedPaymentEntry, GuidedPaymentOutcomes and copyAudit:
  8 files / 74 tests passed.
- LandingPage and transaction-search suites: 3 files / 11 tests passed.
- npm run typecheck:frontend and npm run lint:frontend passed after final copy edits.
- Integrated root gate and browser acceptance belong to ticket 03.
