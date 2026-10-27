# 11: Copied summaries and English CSV exports

**What to build:** Copy coherent order summaries in the selected language and download the existing English CSV with clear localized feedback.

**Blocked by:** 01 — Language switching and buyer order summary

**Status:** ready-for-agent

- [ ] Translate summary labels, lifecycle explanations, purpose text, copy/download controls, loading/empty states, and success/failure/retry feedback.

- [ ] Preserve inserted buyer/product/address/account text, IDs, and business values. Use shared human-readable money/date rules.

- [ ] Identify CSV as English in both locales. Keep headers, status codes, ASCII decimals, Unicode data, field order, filtering, quoting, and formula-injection protection unchanged.

- [ ] Localize known export/clipboard errors and safe unknown-error guidance without exposing technical details as the only explanation.

- [ ] Switch while filters, copied state, or export are pending without re-copying, downloading twice, or issuing another request.

- [ ] Extend rendered clipboard/export tests in both locales and retain backend CSV request checks for authentication, shop isolation, literal route behavior, amounts, headers, Unicode, and formula safety. Existing summary/export APIs permit starting independently of translated order/courier screens.

- [ ] Keep approved standard Bangladeshi Bengali and plain English wording. Include Bengali-capable offline font fallback, phone wrapping and reachable controls, localized document/control language, associated errors, announcements, and preserved keyboard focus; test visible behavior rather than implementation details.

- [ ] Run focused repository tests for changed behavior, then root npm run check as the final pre-handoff gate. Record changed paths, exact results, and failed/blocked/unrun browser or provider acceptance in the existing task record. Mocks and HTTP smoke do not prove live acceptance.
