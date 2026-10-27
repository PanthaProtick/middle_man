# 08: Courier draft, review, locations, and parcel details

**What to build:** Localize the courier draft, review, delivery-location, and
parcel-detail surfaces, including stored/blocking errors, without changing any
booking or reconciliation behavior.

**Blocked by:** 01

**Status:** ready

- [ ] Localize `CourierWorkspace`, `CourierDraft`, `CourierReview`,
      `CourierReviewLocations`, `DeliverySummary`, `ParcelEarlyFields`,
      `parcel.ts` messages, and `useEarlyParcelDetails` errors.
- [ ] Cover draft states, missing parcel fields, review blockers, supported
      coverage, delivery choices, provider connection state, submission progress
      and outcomes, unknown-outcome recovery, reload/review actions, and local
      cancellation warnings.
- [ ] Use approved vocabulary: courier draft = কুরিয়ার অনুরোধের খসড়া. Make clear a
      draft is not a Pathao booking and that submission outcomes distinguish local
      preparation from provider acceptance. Do not enable or bypass eligibility,
      review, booking, or reconciliation gates.
- [ ] Unify blocker/error code label maps across draft and review with an
      unknown-code fallback. For stored provider/reconciliation sentences, show
      localized safe guidance plus an explicit way to view the original message;
      preserve the original as evidence.
- [ ] Preserve Pathao location names/IDs, recipient data, addresses, parcel values,
      and evidence verbatim. Accept Bengali digits at numeric boundaries; keep
      money/precision display at 0-9 digits.
- [ ] Switching language preserves draft edits, selected locations, review state,
      an in-flight submission, and a failed/unknown outcome; it must not resubmit a
      booking, re-run review, or change provider evidence.
- [ ] Extend courier draft/review/location/parcel tests for both locales, code
      fallbacks, original-message disclosure, preserved values, and no repeated
      booking attempt.
- [ ] Focused `npm run test:frontend` passes for these suites.
