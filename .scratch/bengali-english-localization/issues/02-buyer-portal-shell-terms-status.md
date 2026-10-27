# 02: Buyer portal shell, order terms, and status states

**What to build:** Replace inline bilingual copy in the buyer portal shell, order
terms card, and lifecycle status view with selected-language copy, and expose the
locale switch in the buyer header.

**Blocked by:** 01

**Status:** ready

- [ ] Localize `BuyerPortalShell` brand, back link, PIN/OTP guidance, loading,
      public-access-disabled, unavailable/retry, refresh-error, and submission
      error surfaces.
- [ ] Localize `BuyerOrderDetails`: item, order total, delivery advance, remaining
      COD balance, receiving account label, copy/copied feedback, provider name
      handling, and expiry time. Keep shop name, product, account label, number,
      and provider value verbatim.
- [ ] Localize `BuyerStatusView` for awaiting/pending, confirmed, expired,
      rejected, cancelled, reference, COD summary, and refresh states. Pending and
      expired wording remains accurate about automatic expiry.
- [ ] Use approved vocabulary: delivery advance = ডেলিভারির আগে অগ্রিম;
      remaining COD balance = ডেলিভারির সময় বাকি পরিশোধ; confirmed order =
      নিশ্চিত করা অর্ডার. Preserve the seller-acknowledgement disclaimer: seller
      review does not mean provider-verified receipt.
- [ ] Add the locale switch to the buyer header. Switching preserves the order,
      draft values, pending refresh, and any in-flight state; it issues no payment,
      order, AI, or refresh request.
- [ ] Money and timestamps render through the shared formatters with 0-9 digits,
      Bangladesh time, and localized month names. Client-generated buyer errors in
      `usePublicOrder` / `useBuyerSubmission` are localized; backend messages pass
      through until ticket 12 maps stable codes.
- [ ] Extend buyer shell/status tests to render Bengali and English, assert
      observable copy and accessible names, preserved dynamic values, document
      language, and zero additional fetch calls on switch.
- [ ] Focused `npm run test:frontend` passes for the buyer shell and status suites.
