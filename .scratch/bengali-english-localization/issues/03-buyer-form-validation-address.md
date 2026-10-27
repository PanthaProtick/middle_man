# 03: Buyer submission form, validation, and address assistance

**What to build:** Localize the buyer submission form, payment claim fields,
Pathao location picker, and address-assistance UI in both languages while
preserving form state, submitted data, and AI/reservation behavior.

**Blocked by:** 01, 12

**Status:** ready

- [ ] Localize `BuyerSubmissionForm` sections, labels, help, placeholders,
      required/validation errors, submit/progress/failure/recovery copy, and
      accessible descriptions. Keep element ids and API field names unchanged.
- [ ] Localize `PaymentClaimFields`: provider choices, sender number, TrxID, claimed
      amount, and explanation that proof is the buyer's claim. Preserve provider
      names, numbers, and TrxID verbatim; use parenthetical English terms where
      useful, e.g. ট্রানজেকশন আইডি (TrxID).
- [ ] Localize `PathaoLocations` labels, loading/empty/error states, saved-choice
      text, and retry. Preserve authoritative provider location names and IDs
      exactly; never fabricate translated location names.
- [ ] Localize `AddressAssistance` opt-in, limits, loading, unavailable, suggestion,
      use-manual, retention, and error copy. Generated text is shown in the
      language requested when assistance ran; a language switch must not re-run the
      request, change the extracted address, or alter the stored revision.
- [ ] Numeric inputs accept Bengali `০-৯` and normalize at the parse boundary;
      money, phone, and TrxID display keeps 0-9 digits. Free text, names, addresses,
      and opaque identifiers are never rewritten.
- [ ] Map stable server field codes (ticket 12) to localized messages; unknown
      codes fall back to a safe localized explanation plus the original message.
      Preserve first-invalid focus and existing submission/idempotency behavior.
- [ ] Switching language with a populated form, pending submit, failed submit, and
      displayed AI review preserves all values/state and sends no extra request.
- [ ] Extend buyer form, payment claim, Pathao, and address-assistance tests for
      both locales, preserved values, digit acceptance, validation focus, and
      request-count contracts.
- [ ] Focused `npm run test:frontend` passes for these suites.
