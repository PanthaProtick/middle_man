# 11: Copied summaries and CSV presentation

**What to build:** Localize the human-readable copied order summary and the CSV
download UI while keeping the CSV contract English and unchanged.

**Blocked by:** 01, 05, 08

**Status:** ready

- [ ] Localize `OrderExport` UI labels, filter/empty/preparing/success/failure
      messages, and clipboard summary labels, lifecycle explanations, and purpose
      text. The summary must read coherently in Bengali with inserted business data
      preserved.
- [ ] Keep CSV headers, lifecycle/status codes, decimal values, Unicode data,
      quoting, ordering, filtering, and formula-injection protections unchanged.
      No backend export contract or payload changes.
- [ ] Identify the downloaded file as an English CSV in both locales (for example
      a visible note near the download action).
- [ ] Preserve shop/buyer/product/address text, identifiers, amounts, and dates in
      inserted positions; amounts and dates use 0-9 digits and localized labels.
- [ ] Switching language preserves the selected filter, loaded rows, copied state,
      and a pending export; it issues no extra export request and does not re-copy.
- [ ] Extend export tests for Bengali and English clipboard content, the English-
      CSV label, and unchanged backend request behavior. Keep existing backend CSV
      request tests intact.
- [ ] Focused `npm run test:frontend -- src/features/seller/OrderExport.test.tsx`
      and the backend export request tests pass.
