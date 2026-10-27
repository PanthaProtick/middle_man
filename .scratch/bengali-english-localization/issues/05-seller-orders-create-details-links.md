# 05: Seller orders, order creation, details, and buyer links

**What to build:** Localize the seller order list, create-order modal, order
details modal, buyer-link access controls, and link copy feedback.

**Blocked by:** 01

**Status:** ready

- [ ] Localize `OrderList` filters, search/empty/loading/error states, lifecycle
      labels, dates, amounts, review indicators, pagination, and inspect actions.
      Replace raw lifecycle/filter enums with localized labels while keeping
      `option` values and query parameters unchanged.
- [ ] Localize `CreateOrderModal` labels, help, parcel fields, validation, computed
      order total/delivery advance/remaining COD, submit/progress/failure text, and
      accessible names. Bengali digits are accepted and normalized in numeric
      inputs; money/precision behavior is unchanged.
- [ ] Localize `OrderDetailModal` sections, buyer/product/parcel details, payment
      status, allocation/review context, timestamps, close control, and raw enum
      labels. Preserve buyer-written data and IDs verbatim.
- [ ] Localize `BuyerLinkAccess` view/rotate/revoke states, confirmation and caution
      copy, and `BuyerLinkCopy` copy/copied/copying/failure feedback. Do not change
      link generation, revocation, or clipboard payloads.
- [ ] Provide localized labels for unknown/future enum values instead of printing
      bare codes, while retaining a stable fallback.
- [ ] Switching language preserves typed order values, selected filters, open
      dialogs, copied state, and pending requests; it sends no create/link request.
- [ ] Extend order list/create/details/link tests for both locales, preserved
      values, validation, copy feedback, and request counts.
- [ ] Focused `npm run test:frontend` passes for these suites.
