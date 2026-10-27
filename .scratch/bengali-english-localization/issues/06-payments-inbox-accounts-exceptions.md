# 06: Payments inbox, accounts, matching, and exceptions

**What to build:** Localize receiving accounts, payment inbox, manual transaction
entry, payment exception review, and related enum/error presentation.

**Blocked by:** 01

**Status:** ready

- [ ] Localize `PaymentsSection`, `AccountsSection`, `AddAccountForm`,
      `PaymentAccountList`, `TransactionInbox`, `TransactionCard`,
      `ManualTransactionModal`, `PaymentException`, and `paymentDecisions.ts`
      display copy.
- [ ] Cover account add/edit states, provider labels, receiving number guidance,
      empty/loading/error states, transaction filters, unmatched/conflicting/used
      states, manual receipt entry, amounts/dates, approval previews, exception
      blockers, retry, and success/failure feedback.
- [ ] Preserve glossary meaning. Buyer payment proof remains a claim; manual
      approval/matching does not claim independent provider verification. Do not
      weaken amount, sender, account, time, single-use, or unresolved-evidence
      gates.
- [ ] Keep provider names, account numbers, TrxID values, SMS evidence, and opaque
      identifiers verbatim. Stable codes become localized labels with an unknown-
      code fallback.
- [ ] Bengali digits are accepted at numeric boundaries and normalized; displayed
      money uses 0-9 digits and the shared money formatter. Preserve monetary
      precision and validation semantics.
- [ ] Switching language preserves filters, draft receipt values, pending
      approval, failed-operation state, and loaded evidence; no payment mutation or
      repeated approval is sent.
- [ ] Extend payments/accounts/exception tests for both locales, preserved values,
      code fallbacks, formatting, and no repeated mutation on switch.
- [ ] Focused `npm run test:frontend` passes for these suites.
